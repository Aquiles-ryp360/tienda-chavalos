import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { requireAuth } from '@/lib/auth-session'
import { getErrorMessage, readJsonObject } from '@/lib/api-utils'
import { CACHE_TAGS } from '@/lib/cache-tags'
import * as salesAPI from '@backend/API/sales'
import { prisma } from '@/lib/prisma'
import { CustomerDocType, Prisma } from '@prisma/client'

type SaleDetail = NonNullable<Awaited<ReturnType<typeof salesAPI.getSaleById>>>
type SaleDetailItem = SaleDetail['items'][number]

type SerializedSaleDetail = Omit<SaleDetail, 'subtotal' | 'tax' | 'total' | 'items'> & {
  subtotal: number
  tax: number
  total: number
  items: Array<
    Omit<
      SaleDetailItem,
      'soldQty' | 'baseQty' | 'unitPrice' | 'unitPriceOverride' | 'subtotal' | 'presentation'
    > & {
      soldQty: number
      baseQty: number
      unitPrice: number
      unitPriceOverride: number | null
      subtotal: number
      presentation:
        | {
            name: string
            factorToBase: number
          }
        | null
    }
  >
}

const customerDocTypes = new Set(Object.values(CustomerDocType))

function isCustomerDocType(value: string): value is CustomerDocType {
  return customerDocTypes.has(value as CustomerDocType)
}

function serializeSaleDetail(sale: SaleDetail): SerializedSaleDetail {
  return {
    ...sale,
    subtotal: Number(sale.subtotal ?? 0),
    tax: Number(sale.tax ?? 0),
    total: Number(sale.total ?? 0),
    items: sale.items.map((item) => ({
      ...item,
      soldQty: Number(item.soldQty ?? 0),
      baseQty: Number(item.baseQty ?? 0),
      unitPrice: Number(item.unitPrice ?? 0),
      unitPriceOverride:
        item.unitPriceOverride !== null ? Number(item.unitPriceOverride) : null,
      subtotal: Number(item.subtotal ?? 0),
      presentation: item.presentation
        ? {
            ...item.presentation,
            factorToBase: Number(item.presentation.factorToBase ?? 0),
          }
        : null,
    })),
  }
}

/**
 * GET /api/sales/[id] - Obtener venta por ID
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params

    const sale = await salesAPI.getSaleById(id)

    if (!sale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      )
    }

    if (user.role === 'CAJERO' && sale.userId !== user.id) {
      return NextResponse.json(
        { error: 'No autorizado para ver esta venta' },
        { status: 403 }
      )
    }

    return NextResponse.json(serializeSaleDetail(sale))
  } catch (error: unknown) {
    console.error('Error en GET /api/sales/[id]:', error)

    if (getErrorMessage(error) === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Error al obtener venta' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/sales/[id] - Actualizar datos de la boleta
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth()
    const { id } = await params
    const body = await readJsonObject(request)

    const existingSale = await prisma.sale.findUnique({
      where: { id },
      select: { id: true, userId: true, customerDocType: true },
    })

    if (!existingSale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      )
    }

    if (user.role === 'CAJERO' && existingSale.userId !== user.id) {
      return NextResponse.json(
        { error: 'No autorizado para editar esta venta' },
        { status: 403 }
      )
    }

    const updateData: Prisma.SaleUpdateInput = {}
    let nextCustomerDocType: CustomerDocType | null | undefined

    if (body.customerName !== undefined) {
      if (body.customerName === null || body.customerName === '') {
        updateData.customerName = null
      } else {
        const name = String(body.customerName).trim()
        if (name.length > 200) {
          return NextResponse.json(
            { error: 'Nombre de cliente muy largo (máx 200 caracteres)' },
            { status: 400 }
          )
        }
        updateData.customerName = name || null
      }
    }

    if (body.customerDocType !== undefined) {
      const rawDocType = body.customerDocType

      if (rawDocType === null || rawDocType === '') {
        updateData.customerDocType = null
        nextCustomerDocType = null
      } else if (typeof rawDocType !== 'string') {
        return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
      } else {
        let docType = rawDocType.trim().toUpperCase()

        if (docType === 'CEDULA') docType = 'DNI'

        if (!isCustomerDocType(docType)) {
          return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
        }

        updateData.customerDocType = docType
        nextCustomerDocType = docType
      }
    }

    if (body.customerDocNumber !== undefined) {
      const rawDocNumber = body.customerDocNumber

      if (rawDocNumber === null || rawDocNumber === '') {
        updateData.customerDocNumber = null
      } else {
        const docNumber = String(rawDocNumber).trim()

        if (docNumber.length > 20) {
          return NextResponse.json(
            { error: 'Número de documento muy largo (máx 20 caracteres)' },
            { status: 400 }
          )
        }

        const effectiveDocType = nextCustomerDocType ?? existingSale.customerDocType ?? null
        const digitsOnly = /^\d+$/.test(docNumber)

        if (effectiveDocType === 'DNI') {
          if (!digitsOnly || docNumber.length !== 8) {
            return NextResponse.json(
              { error: 'DNI inválido: debe tener exactamente 8 dígitos' },
              { status: 400 }
            )
          }
        } else if (effectiveDocType === 'RUC') {
          if (!digitsOnly || docNumber.length !== 11) {
            return NextResponse.json(
              { error: 'RUC inválido: debe tener exactamente 11 dígitos' },
              { status: 400 }
            )
          }
        } else if (effectiveDocType === 'PASAPORTE') {
          if (!/^[A-Za-z0-9]{6,12}$/.test(docNumber)) {
            return NextResponse.json(
              { error: 'Pasaporte inválido: usa 6 a 12 caracteres alfanuméricos' },
              { status: 400 }
            )
          }
        }

        updateData.customerDocNumber = docNumber || null
      }
    }

    if (body.customerAddress !== undefined) {
      if (body.customerAddress === null || body.customerAddress === '') {
        updateData.customerAddress = null
      } else {
        const address = String(body.customerAddress).trim()
        if (address.length > 500) {
          return NextResponse.json(
            { error: 'Dirección muy larga (máx 500 caracteres)' },
            { status: 400 }
          )
        }
        updateData.customerAddress = address || null
      }
    }

    if (body.institutionName !== undefined) {
      if (body.institutionName === null || body.institutionName === '') {
        updateData.institutionName = null
      } else {
        const institution = String(body.institutionName).trim()
        if (institution.length > 200) {
          return NextResponse.json(
            { error: 'Nombre de institución muy largo (máx 200 caracteres)' },
            { status: 400 }
          )
        }
        updateData.institutionName = institution || null
      }
    }

    if (body.observations !== undefined) {
      if (body.observations === null || body.observations === '') {
        updateData.observations = null
      } else {
        const observations = String(body.observations).trim()
        if (observations.length > 1000) {
          return NextResponse.json(
            { error: 'Observaciones muy largas (máx 1000 caracteres)' },
            { status: 400 }
          )
        }
        updateData.observations = observations || null
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No hay datos para actualizar' },
        { status: 400 }
      )
    }

    const updatedSale = await prisma.sale.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        saleNumber: true,
        userId: true,
        customerName: true,
        customerDocType: true,
        customerDocNumber: true,
        customerAddress: true,
        institutionName: true,
        observations: true,
        paymentMethod: true,
        subtotal: true,
        tax: true,
        total: true,
        stockOverride: true,
        overrideNote: true,
        createdAt: true,
        updatedAt: true,
        items: {
          select: {
            id: true,
            soldUnit: true,
            soldQty: true,
            baseQty: true,
            unitPrice: true,
            unitPriceOverride: true,
            priceAdjustNote: true,
            subtotal: true,
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit: true,
              },
            },
            presentation: {
              select: {
                name: true,
                factorToBase: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
          },
        },
      },
    })

    revalidateTag(CACHE_TAGS.salesList)
    revalidateTag(CACHE_TAGS.dashboardSummary)

    return NextResponse.json(serializeSaleDetail(updatedSale))
  } catch (error: unknown) {
    console.error('Error en PATCH /api/sales/[id]:', error)

    if (getErrorMessage(error) === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Error al actualizar venta' },
      { status: 500 }
    )
  }
}
