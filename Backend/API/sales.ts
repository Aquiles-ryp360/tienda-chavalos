import { prisma } from '@web/lib/prisma'
import type { Sale, ProductPresentation } from '@web/lib/db'
import { PaymentMethod, StockMovementType, ProductUnit, Prisma, UserRole } from '@web/lib/db'

const QUANTITY_EPSILON = 1e-9

/**
 * Convertir Prisma.Decimal (o any) a number de forma estricta
 * Maneja strings, números, Decimals y formatos con comas
 */
function toNumberStrict(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const cleaned = v.trim().replace(',', '.')
    const n = Number(cleaned)
    return n
  }
  // Soporta Decimal-like (prisma/decimal.js)
  if (v && typeof v === 'object') {
    // @ts-ignore
    if (typeof (v as any).toNumber === 'function') return (v as any).toNumber()
    // @ts-ignore
    if (typeof (v as any).valueOf === 'function') return Number((v as any).valueOf())
  }
  return NaN
}

export interface CreateSaleItem {
  productId: string
  presentationId?: string
  soldQty: number
  unitPriceOverride?: number
  priceAdjustNote?: string
}

export interface CreateSaleInput {
  userId: string
  userRole: UserRole
  customerName?: string
  paymentMethod: PaymentMethod
  items: CreateSaleItem[]
  forcePhysicalStock?: boolean
  overrideNote?: string
}

export interface SaleWithDetails extends Sale {
  stockOverride: boolean
  overrideNote: string | null
  items: Array<{
    id: string
    soldUnit: ProductUnit
    soldQty: Prisma.Decimal
    baseQty: Prisma.Decimal
    unitPrice: Prisma.Decimal
    unitPriceOverride: Prisma.Decimal | null
    priceAdjustNote: string | null
    subtotal: Prisma.Decimal
    product: {
      id: string
      sku: string
      name: string
      unit: ProductUnit
    }
    presentation?: {
      name: string
      factorToBase: Prisma.Decimal
    } | null
  }>
  user: {
    id: string
    username: string
    fullName: string
  }
}

export interface InsufficientStockError {
  code: 'INSUFFICIENT_STOCK'
  productId: string
  productName: string
  available: number
  requiredBaseQty: number
  soldQty: number
  unitBase: string
  presentationId?: string
}

const saleListSelect = {
  id: true,
  saleNumber: true,
  createdAt: true,
  customerName: true,
  paymentMethod: true,
  total: true,
  user: {
    select: {
      fullName: true,
    },
  },
} as const

const saleDetailSelect = {
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
      fullName: true,
    },
  },
} as const

/**
 * Determinar si una unidad permite decimales
 */
function unitAllowsDecimals(unit: ProductUnit | string): boolean {
  const decimalUnits = [
    ProductUnit.METRO, 
    ProductUnit.LITRO, 
    ProductUnit.KILO, 
    ProductUnit.CAJA,
    ProductUnit.PAQUETE,
    ProductUnit.ROLLO,
  ]
  return decimalUnits.some(u => u === unit)
}

/**
 * Validar que la cantidad sea correcta según la unidad
 */
function validateQuantity(qty: number, unit: ProductUnit): { valid: boolean; error?: string } {
  if (!Number.isFinite(qty)) {
    return { valid: false, error: 'La cantidad debe ser un número válido' }
  }

  if (qty <= 0) {
    return { valid: false, error: 'La cantidad debe ser mayor a 0' }
  }

  if (!unitAllowsDecimals(unit)) {
    // Unidades discretas: debe ser entero
    if (!Number.isInteger(qty)) {
      return { valid: false, error: `${unit} requiere cantidad entera` }
    }
  } else {
    // Unidades decimales: máximo 3 decimales
    const parts = qty.toString().split('.')
    if (parts[1] && parts[1].length > 3) {
      return { valid: false, error: `Máximo 3 decimales para ${unit}` }
    }
  }

  return { valid: true }
}

function roundToNumber(value: number, decimals: number = 3): number {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function sanitizeQuantity(
  qty: number,
  unit: ProductUnit
): { valid: true; sanitizedQty: number } | { valid: false; error: string } {
  const validation = validateQuantity(qty, unit)
  if (validation.valid) {
    return {
      valid: true,
      sanitizedQty: unitAllowsDecimals(unit) ? roundToNumber(qty, 3) : Math.round(qty),
    }
  }

  if (!unitAllowsDecimals(unit)) {
    const rounded = Math.round(qty)
    if (Math.abs(qty - rounded) <= QUANTITY_EPSILON) {
      return { valid: true, sanitizedQty: rounded }
    }
  } else {
    const rounded = roundToNumber(qty, 3)
    if (Math.abs(qty - rounded) <= QUANTITY_EPSILON) {
      return { valid: true, sanitizedQty: rounded }
    }
  }

  return {
    valid: false,
    error: validation.error ?? 'Cantidad inválida',
  }
}

/**
 * Redondear Decimal a N lugares
 */
function roundDecimal(value: number | Prisma.Decimal, decimals: number = 3): Prisma.Decimal {
  const factor = Math.pow(10, decimals)
  const numValue = typeof value === 'number' ? value : Number(value)
  const rounded = Math.round(numValue * factor) / factor
  return new Prisma.Decimal(rounded)
}

/**
 * Crear venta con transacción atómica, soportando presentaciones, decimales, precios override y stock override
 */
export async function createSale(input: CreateSaleInput): Promise<SaleWithDetails> {
  // Validar permisos para forcePhysicalStock
  if (input.forcePhysicalStock && input.userRole !== UserRole.ADMIN) {
    throw new Error('Solo administrador puede usar forcePhysicalStock')
  }

  // Generar número de venta único
  const lastSale = await prisma.sale.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { saleNumber: true },
  })

  const lastNumber = lastSale ? parseInt(lastSale.saleNumber.split('-')[1]) : 0
  const saleNumber = `VTA-${String(lastNumber + 1).padStart(6, '0')}`

  const productIds = [...new Set(input.items.map((item) => item.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          name: true,
          unit: true,
          price: true,
          stock: true,
          presentations: {
            where: { isActive: true },
            select: {
              id: true,
              productId: true,
              name: true,
              unit: true,
              factorToBase: true,
              priceOverride: true,
              isDefault: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      })
    : []
  const productsById = new Map(products.map((product) => [product.id, product]))

  // Preparar items con validación y cálculo de precios
  const processedItems: Array<{
    productId: string
    presentationId?: string
    soldUnit: ProductUnit
    soldQty: Prisma.Decimal
    baseQty: Prisma.Decimal
    unitPrice: Prisma.Decimal
    unitPriceOverride?: Prisma.Decimal
    priceAdjustNote?: string
    subtotal: Prisma.Decimal
    product: any
    presentation: any
  }> = []

  let subtotal = new Prisma.Decimal(0)
  const tax = new Prisma.Decimal(0)

  // Procesar cada item para validar y calcular baseQty
  for (const item of input.items) {
    // Validar permiso de override de precio
    if (item.unitPriceOverride !== undefined && input.userRole !== UserRole.ADMIN) {
      throw {
        code: 'FORBIDDEN',
        message: 'Solo administradores pueden ajustar precios manualmente',
      }
    }

    const product = productsById.get(item.productId)

    if (!product) {
      throw new Error(`Producto ${item.productId} no encontrado`)
    }

    // Determinar presentación
    let presentation: ProductPresentation | null = null
    // Si presentationId es 'virtual-default', tratarlo como null (presentación por defecto)
    const actualPresentationId = item.presentationId === 'virtual-default' ? null : item.presentationId
    
    if (actualPresentationId) {
      presentation = product.presentations.find((p) => p.id === actualPresentationId) || null
      if (!presentation) {
        throw new Error(`Presentación ${actualPresentationId} no encontrada`)
      }
    } else {
      // Usar presentación por defecto
      presentation = product.presentations.find((p) => p.isDefault) || null
      if (!presentation) {
        // Crear presentación por defecto si no existe
        presentation = {
          id: 'tmp',
          productId: product.id,
          name: product.unit,
          unit: product.unit,
          factorToBase: new Prisma.Decimal(1),
          priceOverride: null,
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any
      }
    }

    // At this point, presentation is guaranteed to be non-null
    const pres = presentation!

    // Validar cantidad según unidad
    const qtyValidation = sanitizeQuantity(item.soldQty, pres.unit)
    if (!qtyValidation.valid) {
      throw new Error(`${product.name}: ${qtyValidation.error}`)
    }

    const sanitizedSoldQty = qtyValidation.sanitizedQty

    // Calcular baseQty redondeando a 3 decimales
    const soldQtyDecimal = roundDecimal(sanitizedSoldQty, 3)
    const baseQty = roundDecimal(Number(soldQtyDecimal) * Number(pres.factorToBase), 3)

    // Validar stock en unidad base (conversión numérica estricta para evitar comparación lexicográfica)
    if (!input.forcePhysicalStock) {
      const availableN = toNumberStrict(product.stock)
      const requiredN = toNumberStrict(baseQty)
      
      // Log de diagnóstico (solo en desarrollo)
      if (process.env.NODE_ENV !== 'production') {
        console.log('[STOCK_VALIDATION]', {
          productName: product.name,
          stockRaw: product.stock,
          stockType: typeof product.stock,
          availableN,
          baseQtyRaw: baseQty,
          baseQtyType: typeof baseQty,
          requiredN,
          insufficient: availableN < requiredN
        })
      }
      
      // Verificar conversión válida
      if (Number.isNaN(availableN) || Number.isNaN(requiredN)) {
        throw new Error(`Error de conversión de stock: available=${product.stock}, required=${baseQty}`)
      }
      
      // Comparación numérica estricta: SOLO disparar error si available < required
      const insufficient = availableN < requiredN
      
      if (insufficient) {
        throw {
          code: 'INSUFFICIENT_STOCK',
          productId: product.id,
          productName: product.name,
          available: availableN,
          requiredBaseQty: requiredN,
          soldQty: sanitizedSoldQty,
          unitBase: product.unit,
          presentationId: pres.id === 'tmp' ? undefined : pres.id,
        } as InsufficientStockError
      }
    }

    // Calcular unitPrice: usar priceOverride si existe, sino calcular
    let unitPrice: Prisma.Decimal
    if (pres.priceOverride !== null && pres.priceOverride !== undefined) {
      unitPrice = new Prisma.Decimal(pres.priceOverride)
    } else {
      unitPrice = new Prisma.Decimal(product.price).mul(pres.factorToBase)
    }
    unitPrice = roundDecimal(unitPrice, 2)

    // Si hay override manual de precio (solo admin), usarlo para el cálculo
    let finalUnitPrice = unitPrice
    let unitPriceOverride: Prisma.Decimal | undefined
    let priceAdjustNote: string | undefined

    if (item.unitPriceOverride !== undefined) {
      unitPriceOverride = roundDecimal(item.unitPriceOverride, 2)
      finalUnitPrice = unitPriceOverride
      priceAdjustNote = item.priceAdjustNote
    }

    // Calcular subtotal usando el precio final (override o normal)
    const itemSubtotal = roundDecimal(Number(soldQtyDecimal) * Number(finalUnitPrice), 2)

    subtotal = subtotal.add(itemSubtotal)

    processedItems.push({
      productId: item.productId,
      presentationId: pres.id === 'tmp' ? undefined : pres.id,
      soldUnit: pres.unit,
      soldQty: soldQtyDecimal,
      baseQty,
      unitPrice,
      unitPriceOverride,
      priceAdjustNote,
      subtotal: itemSubtotal,
      product,
      presentation,
    })
  }

  const total = subtotal.add(tax)

  // Transacción atómica para crear venta
  const sale = await prisma.$transaction(async (tx) => {
    // 1. Crear venta
    const newSale = await tx.sale.create({
      data: {
        saleNumber,
        userId: input.userId,
        customerName: input.customerName,
        paymentMethod: input.paymentMethod,
        subtotal,
        tax,
        total,
        stockOverride: input.forcePhysicalStock || false,
        overrideNote: input.overrideNote || null,
      },
    })

    const txProducts = productIds.length
      ? await tx.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            stock: true,
          },
        })
      : []
    const txProductsById = new Map(
      txProducts.map((product) => [product.id, { stock: product.stock }])
    )

    // 2. Crear items y actualizar stock
    for (const processedItem of processedItems) {
      const productState = txProductsById.get(processedItem.productId)

      if (!productState) {
        throw new Error(`Producto ${processedItem.productId} no encontrado`)
      }

      // Crear item de venta
      await tx.saleItem.create({
        data: {
          saleId: newSale.id,
          productId: processedItem.productId,
          presentationId: processedItem.presentationId,
          soldUnit: processedItem.soldUnit,
          soldQty: processedItem.soldQty,
          baseQty: processedItem.baseQty,
          unitPrice: processedItem.unitPrice,
          unitPriceOverride: processedItem.unitPriceOverride ?? null,
          priceAdjustNote: processedItem.priceAdjustNote || null,
          subtotal: processedItem.subtotal,
        },
      })

      // Actualizar stock (restar baseQty)
      const previousStock = productState.stock
      const newStock = previousStock.sub(processedItem.baseQty)
      await tx.product.update({
        where: { id: processedItem.productId },
        data: { stock: newStock },
      })
      productState.stock = newStock

      // Crear movimiento de stock con nota si es override
      const notes = input.forcePhysicalStock
        ? `Venta ${saleNumber} (OVERRIDE_PHYSICAL_STOCK${input.overrideNote ? ': ' + input.overrideNote : ''})`
        : `Venta ${saleNumber}`

      await tx.stockMovement.create({
        data: {
          productId: processedItem.productId,
          type: StockMovementType.SALIDA,
          quantity: processedItem.baseQty,
          reference: saleNumber,
          notes,
          previousStock,
          newStock,
        },
      })
    }

    // 3. Retornar venta completa con detalles de presentaciones
    return await tx.sale.findUnique({
      where: { id: newSale.id },
      select: saleDetailSelect,
    })
  })

  return sale as SaleWithDetails
}

/**
 * Obtener venta por ID con detalles de presentaciones
 */
export async function getSaleById(id: string): Promise<SaleWithDetails | null> {
  return await prisma.sale.findUnique({
    where: { id },
    select: saleDetailSelect,
  }) as SaleWithDetails | null
}

/**
 * Listar ventas con filtros
 */
export async function listSales(options: {
  userId?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  offset?: number
}) {
  const where: any = {}

  if (options.userId) {
    where.userId = options.userId
  }

  if (options.startDate || options.endDate) {
    where.createdAt = {}
    if (options.startDate) where.createdAt.gte = options.startDate
    if (options.endDate) where.createdAt.lte = options.endDate
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      select: saleListSelect,
      orderBy: { createdAt: 'desc' },
      take: options.limit ?? 50,
      skip: options.offset ?? 0,
    }),
    prisma.sale.count({ where }),
  ])

  return { sales, total }
}
