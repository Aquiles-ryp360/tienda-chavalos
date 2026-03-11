import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-session'
import {
  getErrorMessage,
  readJsonObject,
} from '@/lib/api-utils'
import { CACHE_TAGS } from '@/lib/cache-tags'
import * as priceChangesAPI from '@backend/API/price-changes'

// ── Zod schema para POST /api/price-changes ────────────────────────────────
const CreatePriceChangeSchema = z.object({
  productId: z.string().cuid('productId debe ser un CUID válido'),
  presentationId: z.string().cuid().optional(),
  changeType: z.enum(['SUBIR', 'BAJAR'] as const),
  changeMode: z.enum(['PORCENTAJE', 'MONTO'] as const),
  changeValue: z
    .number()
    .positive('changeValue debe ser mayor que 0')
    .max(1_000_000),
  reason: z
    .string().min(3, 'La razón es obligatoria (mín. 3 caracteres)').max(500)
    .transform(v => v.trim()),
})

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
    const parsed = CreatePriceChangeSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { productId, presentationId, changeType, changeMode, changeValue, reason } = parsed.data

    const result = await priceChangesAPI.createPriceChange(
      { productId, presentationId, changeType, changeMode, changeValue, reason },
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
