import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth } from '@/lib/auth-session'
import {
  getErrorCode,
  getErrorMessage,
  parseBoolean,
  parseJsonObjectArray,
  parseNonEmptyString,
  parseNumberLike,
  readJsonObject,
} from '@/lib/api-utils'
import { CACHE_TAGS } from '@/lib/cache-tags'
import * as salesAPI from '@backend/API/sales'
import type { CreateSaleInput, CreateSaleItem, InsufficientStockError } from '@backend/API/sales'
import { PaymentMethod } from '@prisma/client'

type ListedSale = Awaited<ReturnType<typeof salesAPI.listSales>>['sales'][number]
type CreateSaleRequestBody = Pick<
  CreateSaleInput,
  'customerName' | 'paymentMethod' | 'forcePhysicalStock' | 'overrideNote'
> & {
  items: CreateSaleItem[]
}

const paymentMethods = new Set(Object.values(PaymentMethod))

function isPaymentMethod(value: unknown): value is PaymentMethod {
  return typeof value === 'string' && paymentMethods.has(value as PaymentMethod)
}

function serializeListedSale(sale: ListedSale) {
  return {
    ...sale,
    total: Number(sale.total ?? 0),
  }
}

function parseCreateSaleRequest(body: Record<string, unknown>): CreateSaleRequestBody | null {
  if (!isPaymentMethod(body.paymentMethod)) {
    return null
  }

  const itemObjects = parseJsonObjectArray(body.items)
  if (!itemObjects || itemObjects.length === 0) {
    return null
  }

  const items: CreateSaleItem[] = []

  for (const item of itemObjects) {
    const productId = parseNonEmptyString(item.productId)
    const soldQty = parseNumberLike(item.soldQty)

    if (!productId || soldQty === undefined) {
      return null
    }

    items.push({
      productId,
      presentationId: parseNonEmptyString(item.presentationId),
      soldQty,
      unitPriceOverride: parseNumberLike(item.unitPriceOverride),
      priceAdjustNote: parseNonEmptyString(item.priceAdjustNote),
    })
  }

  return {
    customerName: parseNonEmptyString(body.customerName),
    paymentMethod: body.paymentMethod,
    items,
    forcePhysicalStock: parseBoolean(body.forcePhysicalStock),
    overrideNote: parseNonEmptyString(body.overrideNote),
  }
}

function isInsufficientStockError(error: unknown): error is InsufficientStockError {
  if (typeof error !== 'object' || error === null) {
    return false
  }

  return (
    'code' in error &&
    error.code === 'INSUFFICIENT_STOCK' &&
    'productId' in error &&
    typeof error.productId === 'string'
  )
}

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

    return NextResponse.json({
      ...result,
      sales: result.sales.map(serializeListedSale),
    })
  } catch (error: unknown) {
    console.error('Error en GET /api/sales:', error)

    if (getErrorMessage(error) === 'No autenticado') {
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
    const body = await readJsonObject(request)
    const input = parseCreateSaleRequest(body)

    if (!input?.items.length) {
      return NextResponse.json(
        { error: 'Se requiere al menos un item' },
        { status: 400 }
      )
    }

    if (!input) {
      return NextResponse.json(
        { error: 'Se requiere método de pago' },
        { status: 400 }
      )
    }

    const sale = await salesAPI.createSale({
      userId: user.id,
      userRole: user.role,
      customerName: input.customerName,
      paymentMethod: input.paymentMethod,
      items: input.items,
      forcePhysicalStock: input.forcePhysicalStock,
      overrideNote: input.overrideNote,
    })

    revalidateTag(CACHE_TAGS.salesList)
    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json(sale, { status: 201 })
  } catch (error: unknown) {
    console.error('Error en POST /api/sales:', error)

    const errorMessage = getErrorMessage(error)
    const errorCode = getErrorCode(error)

    if (errorMessage === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (errorMessage?.includes('Solo administrador') || errorCode === 'FORBIDDEN') {
      return NextResponse.json(
        { error: errorMessage || 'Permiso denegado' },
        { status: 403 }
      )
    }

    if (isInsufficientStockError(error)) {
      return NextResponse.json(error, { status: 409 })
    }

    if (
      errorMessage?.includes('Stock insuficiente') ||
      errorMessage?.includes('requiere') ||
      errorMessage?.includes('Máximo')
    ) {
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Error al crear venta' },
      { status: 500 }
    )
  }
}
