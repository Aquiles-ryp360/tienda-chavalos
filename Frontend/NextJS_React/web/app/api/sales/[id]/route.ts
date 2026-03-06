import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-session'
import * as salesAPI from '@backend/API/sales'
import { prisma } from '@/lib/prisma'
import { CustomerDocType } from '@prisma/client'

/**
 * GET /api/sales/[id] - Obtener venta por ID
 */
export async function GET(
  request: NextRequest,
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

    // CAJERO solo puede ver sus propias ventas
    if (user.role === 'CAJERO' && (sale as any).userId !== user.id) {
      return NextResponse.json(
        { error: 'No autorizado para ver esta venta' },
        { status: 403 }
      )
    }

    // Serializar Decimals a numbers
    const serialized = {
      ...sale,
      subtotal: Number((sale as any).subtotal ?? 0),
      tax: Number((sale as any).tax ?? 0),
      total: Number((sale as any).total ?? 0),
      items: (sale.items || []).map((item: any) => ({
        ...item,
        soldQty: Number(item.soldQty ?? 0),
        baseQty: Number(item.baseQty ?? 0),
        unitPrice: Number(item.unitPrice ?? 0),
        subtotal: Number(item.subtotal ?? 0),
        presentation: item.presentation ? {
          ...item.presentation,
          factorToBase: Number(item.presentation.factorToBase ?? 0),
        } : undefined,
      })),
    }

    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('Error en GET /api/sales/[id]:', error)

    if (error.message === 'No autenticado') {
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
    const body = await request.json()

    // Validar que la venta existe
    const existingSale = await prisma.sale.findUnique({
      where: { id },
    })

    if (!existingSale) {
      return NextResponse.json(
        { error: 'Venta no encontrada' },
        { status: 404 }
      )
    }

    // CAJERO solo puede editar sus propias ventas
    if (user.role === 'CAJERO' && existingSale.userId !== user.id) {
      return NextResponse.json(
        { error: 'No autorizado para editar esta venta' },
        { status: 403 }
      )
    }

    // Preparar datos a actualizar
    const updateData: any = {}

    // Validar y sanitizar customerName
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

    // Helper: normaliza strings
const norm = (v: unknown) =>
  typeof v === 'string' ? v.trim().toUpperCase() : v

// Validar customerDocType
if (body.customerDocType !== undefined) {
  const raw = body.customerDocType

  if (raw === null || raw === '') {
    updateData.customerDocType = null
  } else {
    let docType = norm(raw)

    // Alias por compatibilidad (si antes usabas CEDULA)
    if (docType === 'CEDULA') docType = 'DNI'

    // Aceptar solo valores válidos del enum/lista
    if (Object.values(CustomerDocType).includes(docType as any)) {
      updateData.customerDocType = docType as any
    } else {
      return NextResponse.json({ error: 'Tipo de documento inválido' }, { status: 400 })
    }
  }
}

    // Validar customerDocNumber
    if (body.customerDocNumber !== undefined) {
      const raw = body.customerDocNumber

      if (raw === null || raw === '') {
        updateData.customerDocNumber = null
      } else {
        const docNumber = String(raw).trim()

        if (docNumber.length > 20) {
          return NextResponse.json(
            { error: 'Número de documento muy largo (máx 20 caracteres)' },
            { status: 400 }
          )
        }

        // Validación según tipo de documento (si se está enviando/ya existe)
        const effectiveDocType =
          (updateData.customerDocType ?? body.customerDocType ?? null)

        const dt = effectiveDocType ? String(effectiveDocType).trim().toUpperCase() : null
        const digitsOnly = /^\d+$/.test(docNumber)

        if (dt === 'DNI') {
          if (!digitsOnly || docNumber.length !== 8) {
            return NextResponse.json(
              { error: 'DNI inválido: debe tener exactamente 8 dígitos' },
              { status: 400 }
            )
          }
        } else if (dt === 'RUC') {
          if (!digitsOnly || docNumber.length !== 11) {
            return NextResponse.json(
              { error: 'RUC inválido: debe tener exactamente 11 dígitos' },
              { status: 400 }
            )
          }
        } else if (dt === 'PASAPORTE') {
          // Pasaporte: alfanumérico, típico 6-12 (ajusta si deseas)
          const ok = /^[A-Za-z0-9]{6,12}$/.test(docNumber)
          if (!ok) {
            return NextResponse.json(
              { error: 'Pasaporte inválido: usa 6 a 12 caracteres alfanuméricos' },
              { status: 400 }
            )
          }
        } else {
          // OTRO o null: solo límite general ya aplicado
        }

        updateData.customerDocNumber = docNumber || null
      }
    }


    // Validar customerAddress
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

    // Validar institutionName
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

    // Validar observations
    if (body.observations !== undefined) {
      if (body.observations === null || body.observations === '') {
        updateData.observations = null
      } else {
        const obs = String(body.observations).trim()
        if (obs.length > 1000) {
          return NextResponse.json(
            { error: 'Observaciones muy largas (máx 1000 caracteres)' },
            { status: 400 }
          )
        }
        updateData.observations = obs || null
      }
    }

    // Si no hay nada que actualizar
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No hay datos para actualizar' },
        { status: 400 }
      )
    }

    // Actualizar venta
    const updatedSale = await prisma.sale.update({
      where: { id },
      data: updateData,
      include: {
        items: {
          include: {
            product: {
              select: {
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

    // Serializar Decimals
    const serialized = {
      ...updatedSale,
      subtotal: Number(updatedSale.subtotal),
      tax: Number(updatedSale.tax),
      total: Number(updatedSale.total),
      items: updatedSale.items.map((item) => ({
        ...item,
        soldQty: Number(item.soldQty),
        baseQty: Number(item.baseQty),
        unitPrice: Number(item.unitPrice),
        unitPriceOverride: item.unitPriceOverride ? Number(item.unitPriceOverride) : null,
        subtotal: Number(item.subtotal),
        presentation: item.presentation
          ? {
              ...item.presentation,
              factorToBase: Number(item.presentation.factorToBase),
            }
          : null,
      })),
    }

    return NextResponse.json(serialized)
  } catch (error: any) {
    console.error('Error en PATCH /api/sales/[id]:', error)

    if (error.message === 'No autenticado') {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    return NextResponse.json(
      { error: 'Error al actualizar venta' },
      { status: 500 }
    )
  }
}
