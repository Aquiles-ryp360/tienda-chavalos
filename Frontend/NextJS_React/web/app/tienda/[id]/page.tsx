import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import styles from '../tienda.module.css'
import { ForumSection } from './ForumSection'

function formatPrice(price: unknown): string {
  const n = Number(price)
  return `C$ ${n.toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Metadata dinámica para SEO
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const product = await prisma.product.findUnique({
    where:  { id, isActive: true },
    select: { name: true, description: true },
  })
  if (!product) return { title: 'Producto no encontrado' }
  return {
    title:       `${product.name} — Ferretería Chavalos`,
    description: product.description ?? `Ver precio y comentarios de ${product.name}`,
  }
}

export default async function ProductoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const product = await prisma.product.findUnique({
    where:  { id, isActive: true },
    select: {
      id:          true,
      sku:         true,
      name:        true,
      description: true,
      unit:        true,
      price:       true,
      presentations: {
        where:   { isActive: true },
        select:  { id: true, name: true, unit: true, priceOverride: true, factorToBase: true },
        orderBy: { isDefault: 'desc' },
      },
    },
  })

  if (!product) notFound()

  return (
    <>
      {/* Encabezado del producto */}
      <div className={styles.productHeader}>
        <Link href="/tienda" className={styles.backLink}>
          ← Volver al catálogo
        </Link>

        <p className={styles.productSku}>SKU: {product.sku}</p>
        <h1 className={styles.productName}>{product.name}</h1>

        {product.description && (
          <p className={styles.productDescription}>{product.description}</p>
        )}

        <div className={styles.productMeta}>
          <span className={styles.productPrice}>{formatPrice(product.price)}</span>
          <span className={styles.productUnit}>por {product.unit.toLowerCase()}</span>
        </div>

        {/* Presentaciones adicionales */}
        {product.presentations.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Presentaciones disponibles:
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {product.presentations.map(p => (
                <span
                  key={p.id}
                  style={{
                    fontSize:     '0.8rem',
                    background:   'var(--bg-alt)',
                    border:       '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding:      '0.2rem 0.6rem',
                    color:        'var(--text-secondary)',
                  }}
                >
                  {p.name}
                  {p.priceOverride && (
                    <strong style={{ marginLeft: '0.4rem', color: 'var(--success)' }}>
                      {formatPrice(p.priceOverride)}
                    </strong>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sección del foro */}
      <ForumSection productId={product.id} />
    </>
  )
}
