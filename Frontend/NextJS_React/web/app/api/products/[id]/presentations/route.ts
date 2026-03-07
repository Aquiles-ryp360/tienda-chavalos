import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth } from '@/lib/auth-session'
import {
  getErrorMessage,
  parseBoolean,
  parseNonEmptyString,
  parseNumberLike,
  readJsonObject,
} from '@/lib/api-utils'
import { CACHE_TAGS } from '@/lib/cache-tags'
import * as productsAPI from '@backend/API/products'
import { ProductUnit } from '@web/lib/db'

const productUnits = new Set(Object.values(ProductUnit))

function isProductUnit(value: unknown): value is ProductUnit {
  return typeof value === 'string' && productUnits.has(value as ProductUnit)
}

/**
 * POST /api/products/{id}/presentations - Crear/actualizar presentación
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { id } = await params
    const body = await readJsonObject(request)
    const name = parseNonEmptyString(body.name)
    const factorToBase = parseNumberLike(body.factorToBase)

    if (!name || !isProductUnit(body.unit) || factorToBase === undefined) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos: name, unit, factorToBase' },
        { status: 400 }
      )
    }

    if (factorToBase <= 0) {
      return NextResponse.json(
        { error: 'factorToBase debe ser mayor a 0' },
        { status: 400 }
      )
    }

    const result = await productsAPI.createProductPresentation({
      productId: id,
      name,
      unit: body.unit,
      factorToBase,
      priceOverride: body.priceOverride === null ? undefined : parseNumberLike(body.priceOverride),
      isDefault: parseBoolean(body.isDefault),
    })

    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json(result, { status: 201 })
  } catch (error: unknown) {
    console.error('Error en POST /api/products/[id]/presentations:', error)

    const errorMessage = getErrorMessage(error)

    if (errorMessage === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (errorMessage?.includes('no encontrado')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
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
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const body = await readJsonObject(request)
    const presentationId = parseNonEmptyString(body.presentationId)

    if (!presentationId) {
      return NextResponse.json(
        { error: 'Se requiere presentationId' },
        { status: 400 }
      )
    }

    await productsAPI.deleteProductPresentation(presentationId)

    revalidateTag(CACHE_TAGS.productsList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Error en DELETE /api/products/[id]/presentations/[presentationId]:', error)

    const errorMessage = getErrorMessage(error)

    if (errorMessage === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (errorMessage?.includes('no encontrada')) {
      return NextResponse.json({ error: errorMessage }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Error al eliminar presentación' },
      { status: 500 }
    )
  }
}
