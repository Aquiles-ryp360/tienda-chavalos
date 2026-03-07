import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth } from '@/lib/auth-session'
import { CACHE_TAGS } from '@/lib/cache-tags'
import * as salesAPI from '@backend/API/sales'

/**
 * GET /api/sales - Listar ventas
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const startDate = searchParams.get('startDate')
      ? new Date(searchParams.get('startDate')!)
      : undefined
    const endDate = searchParams.get('endDate')
      ? new Date(searchParams.get('endDate')!)
      : undefined

    const result = await salesAPI.listSales({
      userId: user.role === 'CAJERO' ? user.id : undefined,
      startDate,
      endDate,
      limit,
      offset,
    })

    // Serializar Decimals a numbers
    const serialized = {
      ...result,
      sales: (result.sales || []).map((sale: any) => ({
        ...sale,
        total: Number(sale.total ?? 0),
      })),
    }

    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('Error en GET /api/sales:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Error al obtener ventas' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/sales - Crear venta con presentaciones
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await request.json()

    // Validar campos requeridos
    if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: 'Se requiere al menos un item' },
        { status: 400 }
      )
    }

    if (!body.paymentMethod) {
      return NextResponse.json(
        { error: 'Se requiere método de pago' },
        { status: 400 }
      )
    }

    // Crear venta
    const sale = await salesAPI.createSale({
      userId: user.id,
      userRole: user.role,
      customerName: body.customerName,
      paymentMethod: body.paymentMethod,
      items: body.items.map((item: any) => ({
        productId: item.productId,
        presentationId: item.presentationId,
        soldQty: item.soldQty,
        unitPriceOverride: item.unitPriceOverride,
        priceAdjustNote: item.priceAdjustNote,
      })),
      forcePhysicalStock: body.forcePhysicalStock,
      overrideNote: body.overrideNote,
    })

    revalidateTag(CACHE_TAGS.salesList)
    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json(sale, { status: 201 })
  } catch (error: any) {
    console.error('Error en POST /api/sales:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    // Manejar error de permisos para forcePhysicalStock o ajuste de precio
    if (error.message?.includes('Solo administrador') || error.code === 'FORBIDDEN') {
      return NextResponse.json(
        { error: error.message || 'Permiso denegado' },
        { status: 403 }
      )
    }

    // Manejar error de stock insuficiente (nuevo formato)
    if (error.code === 'INSUFFICIENT_STOCK') {
      return NextResponse.json(error, { status: 409 })
    }

    if (
      error.message?.includes('Stock insuficiente') ||
      error.message?.includes('requiere') ||
      error.message?.includes('Máximo')
    ) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al crear venta' },
      { status: 500 }
    )
  }
}

