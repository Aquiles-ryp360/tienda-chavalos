import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth } from '@/lib/auth-session'
import {
  getErrorMessage,
  parseNonEmptyString,
  parseNumberLike,
  readJsonObject,
} from '@/lib/api-utils'
import { CACHE_TAGS } from '@/lib/cache-tags'
import * as priceChangesAPI from '@backend/API/price-changes'

const priceChangeTypes = new Set(['SUBIR', 'BAJAR'])
const priceChangeModes = new Set(['PORCENTAJE', 'MONTO'])

function isPriceChangeType(
  value: unknown
): value is priceChangesAPI.CreatePriceChangeInput['changeType'] {
  return typeof value === 'string' && priceChangeTypes.has(value)
}

function isPriceChangeMode(
  value: unknown
): value is priceChangesAPI.CreatePriceChangeInput['changeMode'] {
  return typeof value === 'string' && priceChangeModes.has(value)
}

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
  } catch (error: unknown) {
    console.error('Error en GET /api/price-changes:', error)

    if (getErrorMessage(error) === 'No autenticado') {
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

    const body = await readJsonObject(request)
    const productId = parseNonEmptyString(body.productId)
    const presentationId = parseNonEmptyString(body.presentationId)
    const reason = parseNonEmptyString(body.reason)
    const changeValue = parseNumberLike(body.changeValue)

    if (
      !productId ||
      !isPriceChangeType(body.changeType) ||
      !isPriceChangeMode(body.changeMode) ||
      !reason
    ) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    if (changeValue === undefined || changeValue <= 0) {
      return NextResponse.json(
        { error: 'El valor de cambio debe ser un número positivo' },
        { status: 400 }
      )
    }

    const result = await priceChangesAPI.createPriceChange(
      {
        productId,
        presentationId,
        changeType: body.changeType,
        changeMode: body.changeMode,
        changeValue,
        reason,
      },
      user.id
    )

    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    console.error('Error en POST /api/price-changes:', error)

    const errorMessage = getErrorMessage(error)

    if (errorMessage === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (errorMessage?.includes('no encontrado')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Error al crear cambio de precio' },
      { status: 500 }
    )
  }
}
