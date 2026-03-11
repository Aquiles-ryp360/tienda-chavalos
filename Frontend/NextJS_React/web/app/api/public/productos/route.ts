import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/public/productos
 * Lista pública de productos activos. Sin autenticación requerida.
 * Query params:
 *   q       — búsqueda en nombre, SKU o descripción
 *   cursor  — ID del último producto visto (paginación cursor)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q      = searchParams.get('q')?.trim() ?? ''
  const cursor = searchParams.get('cursor')
  const TAKE   = 48

  const where = {
    isActive: true,
    ...(q && {
      OR: [
        { name:        { contains: q, mode: 'insensitive' as const } },
        { sku:         { contains: q, mode: 'insensitive' as const } },
        { description: { contains: q, mode: 'insensitive' as const } },
      ],
    }),
  }

  const products = await prisma.product.findMany({
    where,
    select: {
      id:          true,
      sku:         true,
      name:        true,
      description: true,
      unit:        true,
      price:       true,
    },
    orderBy: { name: 'asc' },
    take: TAKE + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  const hasMore    = products.length > TAKE
  const items      = hasMore ? products.slice(0, TAKE) : products
  const nextCursor = hasMore ? items[items.length - 1].id : null

  return NextResponse.json({ items, nextCursor })
}
