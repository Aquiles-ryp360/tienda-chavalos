import { prisma } from '@web/lib/prisma'
import { Decimal, type Prisma } from '@web/lib/db'

export interface CreatePriceChangeInput {
  productId: string
  presentationId?: string
  changeType: 'SUBIR' | 'BAJAR'
  changeMode: 'PORCENTAJE' | 'MONTO'
  changeValue: number
  reason: string
}

export interface PriceChangeResult {
  id: string
  productId: string
  presentationId?: string
  oldPrice: number
  newPrice: number
  changeValue: number
  reason: string
  createdAt: Date
}

type PriceChangeWithRelations = Prisma.PriceChangeGetPayload<{
  include: {
    product: {
      select: {
        id: true
        name: true
        price: true
      }
    }
    presentation: {
      select: {
        id: true
        name: true
        priceOverride: true
      }
    }
    user: {
      select: {
        id: true
        username: true
        fullName: true
      }
    }
  }
}>

/**
 * Crear cambio de precio
 */
export async function createPriceChange(
  input: CreatePriceChangeInput,
  userId: string
): Promise<PriceChangeResult> {
  // Obtener producto
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    include: {
      presentations: {
        where: { id: input.presentationId },
      },
    },
  })

  if (!product) {
    throw new Error(`Producto ${input.productId} no encontrado`)
  }

  let oldPrice: Decimal
  let newPrice: Decimal

  if (input.presentationId) {
    // Cambio en presentación
    const presentation = product.presentations[0]
    if (!presentation) {
      throw new Error(`Presentación ${input.presentationId} no encontrada`)
    }

    oldPrice = presentation.priceOverride || product.price
    const basePrice = Number(oldPrice)

    let calculatedNewPrice: number
    if (input.changeMode === 'PORCENTAJE') {
      const factor = input.changeType === 'SUBIR' ? 1 + input.changeValue / 100 : 1 - input.changeValue / 100
      calculatedNewPrice = basePrice * factor
    } else {
      // MONTO
      calculatedNewPrice =
        input.changeType === 'SUBIR' ? basePrice + input.changeValue : basePrice - input.changeValue
    }

    newPrice = new Decimal(Math.max(0, calculatedNewPrice).toFixed(2))

    // Actualizar presentación
    await prisma.productPresentation.update({
      where: { id: input.presentationId },
      data: { priceOverride: newPrice },
    })
  } else {
    // Cambio en producto base
    oldPrice = product.price
    const basePrice = Number(oldPrice)

    let calculatedNewPrice: number
    if (input.changeMode === 'PORCENTAJE') {
      const factor = input.changeType === 'SUBIR' ? 1 + input.changeValue / 100 : 1 - input.changeValue / 100
      calculatedNewPrice = basePrice * factor
    } else {
      // MONTO
      calculatedNewPrice =
        input.changeType === 'SUBIR' ? basePrice + input.changeValue : basePrice - input.changeValue
    }

    newPrice = new Decimal(Math.max(0, calculatedNewPrice).toFixed(2))

    // Actualizar producto
    await prisma.product.update({
      where: { id: input.productId },
      data: { price: newPrice },
    })
  }

  // Crear registro de cambio
  const priceChange = await prisma.priceChange.create({
    data: {
      productId: input.productId,
      presentationId: input.presentationId,
      oldPrice,
      newPrice,
      reason: input.reason,
      userId,
    },
  })

  return {
    id: priceChange.id,
    productId: priceChange.productId,
    presentationId: priceChange.presentationId || undefined,
    oldPrice: Number(priceChange.oldPrice),
    newPrice: Number(priceChange.newPrice),
    changeValue: Number(newPrice) - Number(oldPrice),
    reason: priceChange.reason,
    createdAt: priceChange.createdAt,
  }
}

/**
 * Obtener historial de cambios de precio
 */
export async function getPriceChangeHistory(options: {
  productId?: string
  presentationId?: string
  limit?: number
  offset?: number
}) {
  const where: any = {}

  if (options.productId) {
    where.productId = options.productId
  }

  if (options.presentationId) {
    where.presentationId = options.presentationId
  }

  const [changes, total]: [PriceChangeWithRelations[], number] = await Promise.all([
    prisma.priceChange.findMany({
      where,
      include: {
        product: {
          select: {
            id: true,
            name: true,
            price: true,
          },
        },
        presentation: {
          select: {
            id: true,
            name: true,
            priceOverride: true,
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
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.priceChange.count({ where }),
  ])

  const serialized = changes.map((change) => ({
    id: change.id,
    productId: change.productId,
    productName: change.product.name,
    presentationId: change.presentationId || undefined,
    presentationName: change.presentation?.name,
    oldPrice: Number(change.oldPrice),
    newPrice: Number(change.newPrice),
    changeValue: Number(change.newPrice) - Number(change.oldPrice),
    reason: change.reason,
    user: {
      id: change.user.id,
      username: change.user.username,
      fullName: change.user.fullName,
    },
    createdAt: change.createdAt,
  }))

  return { changes: serialized, total }
}
