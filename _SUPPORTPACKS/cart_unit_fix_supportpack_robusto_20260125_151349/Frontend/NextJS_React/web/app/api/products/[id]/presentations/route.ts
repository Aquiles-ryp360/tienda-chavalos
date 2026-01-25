import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-session'
import * as productsAPI from '@backend/API/products'
import { ProductUnit } from '@web/lib/db'

/**
 * POST /api/products/{id}/presentations - Crear/actualizar presentación
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()

    // Validar campos requeridos
    if (!body.name || !body.unit || typeof body.factorToBase !== 'number') {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, unit, factorToBase' },
        { status: 400 }
      )
    }

    if (body.factorToBase <= 0) {
      return NextResponse.json(
        { error: 'factorToBase debe ser mayor a 0' },
        { status: 400 }
      )
    }

    const result = await productsAPI.createProductPresentation({
      productId: id,
      name: body.name,
      unit: body.unit as ProductUnit,
      factorToBase: body.factorToBase,
      priceOverride: body.priceOverride,
      isDefault: body.isDefault,
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/products/[id]/presentations:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (error.message?.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Error al crear presentación' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/products/{id}/presentations - Eliminar presentación
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()
    
    if (!body.presentationId) {
      return NextResponse.json(
        { error: 'Se requiere presentationId' },
        { status: 400 }
      )
    }

    await productsAPI.deleteProductPresentation(body.presentationId)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error en DELETE /api/products/[id]/presentations/[presentationId]:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (error.message?.includes('no encontrada')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Error al eliminar presentación' },
      { status: 500 }
    )
  }
}
