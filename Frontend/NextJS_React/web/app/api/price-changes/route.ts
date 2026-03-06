import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-session'
import * as priceChangesAPI from '@backend/API/price-changes'

/**
 * GET /api/price-changes - Obtener historial de cambios de precio
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId') || undefined
    const presentationId = searchParams.get('presentationId') || undefined
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    const result = await priceChangesAPI.getPriceChangeHistory({
      productId,
      presentationId,
      limit,
      offset,
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error en GET /api/price-changes:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Error al obtener historial de cambios' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/price-changes - Crear cambio de precio
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await request.json()

    // Validar campos requeridos
    if (!body.productId || !body.changeType || !body.changeMode || !body.reason) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    if (typeof body.changeValue !== 'number' || body.changeValue <= 0) {
      return NextResponse.json(
        { error: 'El valor de cambio debe ser un número positivo' },
        { status: 400 }
      )
    }

    const result = await priceChangesAPI.createPriceChange(
      {
        productId: body.productId,
        presentationId: body.presentationId,
        changeType: body.changeType,
        changeMode: body.changeMode,
        changeValue: body.changeValue,
        reason: body.reason,
      },
      user.id
    )

    return NextResponse.json(result, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/price-changes:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (error.message?.includes('no encontrado')) {
      return NextResponse.json({ error: error.message }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Error al crear cambio de precio' },
      { status: 500 }
    )
  }
}
