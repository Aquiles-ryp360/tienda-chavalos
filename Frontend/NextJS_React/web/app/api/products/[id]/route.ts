import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth, requireAdmin } from '@/lib/auth-session'
import {
  getErrorCode,
  getErrorMessage,
  getErrorProperty,
  parseBoolean,
  parseNonEmptyString,
  parseNumberLike,
  readJsonObject,
} from '@/lib/api-utils'
import { CACHE_TAGS } from '@/lib/cache-tags'
import * as productsAPI from '@backend/API/products'
import { ProductUnit } from '@web/lib/db'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const productUnits = new Set(Object.values(ProductUnit))

function isProductUnit(value: unknown): value is ProductUnit {
  return typeof value === 'string' && productUnits.has(value as ProductUnit)
}

function parseUpdateProductInput(
  body: Record<string, unknown>
): productsAPI.UpdateProductInput {
  const input: productsAPI.UpdateProductInput = {}
  const sku = parseNonEmptyString(body.sku)
  const name = parseNonEmptyString(body.name)
  const price = parseNumberLike(body.price)
  const stock = parseNumberLike(body.stock)
  const minStock = parseNumberLike(body.minStock)
  const isActive = parseBoolean(body.isActive)

  if (sku) input.sku = sku
  if (name) input.name = name
  if (body.description === null || typeof body.description === 'string') {
    input.description = body.description
  }
  if (isProductUnit(body.unit)) input.unit = body.unit
  if (price !== undefined) input.price = price
  if (stock !== undefined) input.stock = stock
  if (minStock !== undefined) input.minStock = minStock
  if (isActive !== undefined) input.isActive = isActive

  return input
}

/**
 * GET /api/products/[id] - Obtener producto por ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth()
    const { id } = await params

    const product = await productsAPI.getProductById(id)

    if (!product) {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(product)
  } catch (error: unknown) {
    console.error('Error en GET /api/products/[id]:', error)

    if (getErrorMessage(error) === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Error al obtener producto' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/products/[id] - Actualizar producto (solo ADMIN)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await readJsonObject(request)

    const product = await productsAPI.updateProduct(id, parseUpdateProductInput(body))

    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json(product)
  } catch (error: unknown) {
    console.error('Error en PATCH /api/products/[id]:', error)

    const errorMessage = getErrorMessage(error)
    const errorCode = getErrorCode(error)

    if (errorMessage === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (errorMessage === 'Requiere rol ADMIN') {
      return NextResponse.json({ error: 'Requiere rol ADMIN' }, { status: 403 })
    }

    if (errorCode === 'P2025') {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    if (errorCode === 'DUPLICATE_PRODUCT_NAME') {
      return NextResponse.json(
        {
          error: 'Ya existe un producto con ese nombre',
          existing: getErrorProperty(error, 'existing'),
        },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Error al actualizar producto' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/[id] - Eliminar producto (solo ADMIN)
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    await productsAPI.deleteProduct(id)

    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error en DELETE /api/products/[id]:', error)

    const errorMessage = getErrorMessage(error)

    if (errorMessage === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (errorMessage === 'Requiere rol ADMIN') {
      return NextResponse.json({ error: 'Requiere rol ADMIN' }, { status: 403 })
    }

    if (getErrorCode(error) === 'P2025') {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    )
  }
}
