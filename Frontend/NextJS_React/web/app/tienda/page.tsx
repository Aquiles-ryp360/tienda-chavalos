import Link from 'next/link'
import { Suspense } from 'react'
import { prisma } from '@/lib/prisma'
import styles from './tienda.module.css'
import { SearchInput } from './SearchInput'

// Formato de precio en córdobas nicaragüenses
function formatPrice(price: unknown): string {
  const n = Number(price)
  return `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function ProductGrid({ q }: { q: string }) {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      ...(q && {
        OR: [
          { name:        { contains: q, mode: 'insensitive' } },
          { sku:         { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    select: {
      id:          true,
      sku:         true,
      name:        true,
      description: true,
      unit:        true,
      price:       true,
      _count:      { select: { forumPosts: { where: { isHidden: false } } } },
    },
    orderBy: { name: 'asc' },
    take: 200,
  })

  if (products.length === 0) {
    return (
      <div className={styles.empty}>
        <p>🔍</p>
        <p>No se encontraron productos{q ? ` para "${q}"` : ''}.</p>
      </div>
    )
  }

  return (
    <div className={styles.grid}>
      {products.map(p => (
        <Link key={p.id} href={`/tienda/${p.id}`} className={styles.card}>
          <span className={styles.cardSku}>{p.sku}</span>
          <span className={styles.cardName}>{p.name}</span>
          {p.description && (
            <span className={styles.cardDesc}>{p.description}</span>
          )}
          <div className={styles.cardFooter}>
            <span className={styles.cardPrice}>{formatPrice(p.price)}</span>
            <span className={styles.cardUnit}>/{p.unit.toLowerCase()}</span>
          </div>
          {p._count.forumPosts > 0 && (
            <span className={styles.cardForumBadge}>
              💬 {p._count.forumPosts} comentario{p._count.forumPosts !== 1 ? 's' : ''}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}

export default async function TiendaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams

  return (
    <>
      <h1 className={styles.pageTitle}>Catálogo de productos</h1>
      <p className={styles.pageSubtitle}>
        Explora nuestros artículos, precios y deja tu comentario en cada producto.
      </p>

      <div className={styles.searchRow}>
        <Suspense fallback={null}>
          <SearchInput />
        </Suspense>
      </div>

      <Suspense
        fallback={<div className={styles.forumLoading}>Cargando productos…</div>}
      >
        <ProductGrid q={q} />
      </Suspense>
    </>
  )
}
