import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireAdmin } from '@/lib/auth-session'
import * as productsAPI from '@backend/API/products'

export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * GET /api/products/[id] - Obtener producto por ID
 */
export async function GET(
  request: NextRequest,
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
  } catch (error: any) {
    console.error('Error en GET /api/products/[id]:', error)

    if (error.message === 'No autenticado') {
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
    const body = await request.json()

    const product = await productsAPI.updateProduct(id, body)

    return NextResponse.json(product)
  } catch (error: any) {
    console.error('Error en PATCH /api/products/[id]:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (error.message === 'Requiere rol ADMIN') {
      return NextResponse.json({ error: 'Requiere rol ADMIN' }, { status: 403 })
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const { id } = await params

    await productsAPI.deleteProduct(id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error en DELETE /api/products/[id]:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (error.message === 'Requiere rol ADMIN') {
      return NextResponse.json({ error: 'Requiere rol ADMIN' }, { status: 403 })
    }

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Producto no encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: 'Error al eliminar producto' },
      { status: 500 }
    )
    
        if (error.code === 'DUPLICATE_PRODUCT_NAME') {
      return NextResponse.json(
        { error: 'Ya existe un producto con ese nombre', existing: error.existing },
        { status: 409 }
      )
    }



  }
}
