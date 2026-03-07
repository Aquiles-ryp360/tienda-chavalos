import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth, requireAdmin } from '@/lib/auth-session'
import {
  getErrorCode,
  getErrorMessage,
  getErrorProperty,
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

function parseCreateProductInput(
  body: Record<string, unknown>
): productsAPI.CreateProductInput | null {
  const sku = parseNonEmptyString(body.sku)
  const name = parseNonEmptyString(body.name)
  const price = parseNumberLike(body.price)
  const stock = parseNumberLike(body.stock)
  const minStock = parseNumberLike(body.minStock)

  if (!sku || !name || !isProductUnit(body.unit) || price === undefined || stock === undefined) {
    return null
  }

  return {
    sku,
    name,
    description: typeof body.description === 'string' ? body.description : undefined,
    unit: body.unit,
    price,
    stock,
    minStock,
  }
}

/**
 * GET /api/products - Listar y buscar productos
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || searchParams.get('q') || undefined
    const isActiveParam = searchParams.get('isActive')
    const includePresentations = searchParams.get('includePresentations') === '1'
    const inStockOnly = searchParams.get('inStockOnly') === '1'
    const limit = parseInt(
      searchParams.get('limit') ||
        searchParams.get('take') ||
        '50'
    )
    const offset = parseInt(searchParams.get('offset') || searchParams.get('skip') || '0')
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined
    const suggest = searchParams.get('suggest') === '1'

    if (suggest && search) {
      const result = await productsAPI.suggestProducts({ search, isActive, limit })
      return NextResponse.json(result)
    }

    const result = await productsAPI.searchProducts({
      search,
      isActive,
      inStockOnly,
      includePresentations,
      limit,
      offset,
    })

    return NextResponse.json({
      ...result,
      items: result.products,
      products: result.products,
      total: result.total,
      take: limit,
      skip: offset,
      limit,
      offset,
    })
  } catch (error: unknown) {
    if (getErrorMessage(error) === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    console.error('Error en GET /api/products:', error)

    return NextResponse.json(
      { error: 'Error al obtener productos' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/products - Crear producto (solo ADMIN)
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()

    const body = await readJsonObject(request)
    const input = parseCreateProductInput(body)

    if (!input) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: sku, name, unit, price, stock' },
        { status: 400 }
      )
    }

    const product = await productsAPI.createProduct(input)

    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json(
      {
        ...product,
        price: Number(product.price),
        stock: Number(product.stock),
        minStock: Number(product.minStock),
      },
      { status: 201 }
    )
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error)
    const errorCode = getErrorCode(error)

    if (errorMessage === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (errorMessage === 'Requiere rol ADMIN') {
      return NextResponse.json({ error: 'Requiere rol ADMIN' }, { status: 403 })
    }

    console.error('Error en POST /api/products:', error)

    if (errorCode === 'DUPLICATE_PRODUCT_NAME') {
      return NextResponse.json(
        {
          error: 'Ya existe un producto con ese nombre',
          existing: getErrorProperty(error, 'existing'),
        },
        { status: 409 }
      )
    }

    if (errorCode === 'P2002') {
      return NextResponse.json(
        { error: 'El SKU ya existe' },
        { status: 409 }
      )
    }

    return NextResponse.json(
      { error: 'Error al crear producto' },
      { status: 500 }
    )
  }
}
