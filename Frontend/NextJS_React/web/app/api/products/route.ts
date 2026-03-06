import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/auth-session'
import * as productsAPI from '@backend/API/products'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/products - Listar y buscar productos
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || searchParams.get('q') || undefined
    const isActiveParam = searchParams.get('isActive')
    const limit = parseInt(
      searchParams.get('limit') ||
        searchParams.get('take') ||
        '50'
    )
    const offset = parseInt(searchParams.get('offset') || searchParams.get('skip') || '0')

    //.............................................
    const isActive = isActiveParam === 'true' ? true : isActiveParam === 'false' ? false : undefined

    const suggest = searchParams.get('suggest') === '1'

    if (suggest && search) {
      const result = await productsAPI.suggestProducts({ search, isActive, limit })
      return NextResponse.json(result)
    } 
    //.............................................


    const result = await productsAPI.searchProducts({
      search,
      isActive,
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
  } catch (error: any) {
    if (error.message === 'No autenticado') {
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

    const body = await request.json()

    // Validar campos requeridos
    if (!body.sku || !body.name || !body.unit || body.price === undefined || body.stock === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: sku, name, unit, price, stock' },
        { status: 400 }
      )
    }

    const product = await productsAPI.createProduct({
      sku: body.sku,
      name: body.name,
      description: body.description,
      unit: body.unit,
      price: parseFloat(body.price),
      stock: parseFloat(body.stock),
      minStock: body.minStock ? parseFloat(body.minStock) : undefined,
    })

    return NextResponse.json(
      {
        ...product,
        price: Number(product.price),
        stock: Number(product.stock),
        minStock: Number(product.minStock),
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (error.message === 'Requiere rol ADMIN') {
      return NextResponse.json({ error: 'Requiere rol ADMIN' }, { status: 403 })
    }

    console.error('Error en POST /api/products:', error)

    if (error.code === 'DUPLICATE_PRODUCT_NAME') {
      return NextResponse.json(
        { error: 'Ya existe un producto con ese nombre', existing: error.existing },
        { status: 409 }
      )
    }

    if (error.code === 'P2002') {
      // Conflicto de índice único (normalmente SKU)
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
