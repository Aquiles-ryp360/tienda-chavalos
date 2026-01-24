import { prisma } from '@/lib/prisma'
import { Prisma } from '@web/lib/db'

/**
 * Convertir Prisma.Decimal (o any) a number de forma estricta
 */
function toNumberStrict(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const cleaned = v.trim().replace(',', '.')
    const n = Number(cleaned)
    return n
  }
  if (v && typeof v === 'object') {
    // @ts-ignore
    if (typeof (v as any).toNumber === 'function') return (v as any).toNumber()
    // @ts-ignore
    if (typeof (v as any).valueOf === 'function') return Number((v as any).valueOf())
  }
  return NaN
}

export interface StockValidationItem {
  productId: string
  baseQty: Prisma.Decimal
}

export interface StockValidationResult {
  valid: boolean
  errors: Array<{
    productId: string
    productName: string
    requested: Prisma.Decimal
    available: Prisma.Decimal
  }>
}

/**
 * Validar disponibilidad de stock en unidad base para múltiples productos
 */
export async function validateStock(
  items: StockValidationItem[]
): Promise<StockValidationResult> {
  const errors: StockValidationResult['errors'] = []

  for (const item of items) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, stock: true, isActive: true, unit: true },
    })

    if (!product) {
      errors.push({
        productId: item.productId,
        productName: 'Producto no encontrado',
        requested: item.baseQty,
        available: new Prisma.Decimal(0),
      })
      continue
    }

    if (!product.isActive) {
      errors.push({
        productId: item.productId,
        productName: product.name,
        requested: item.baseQty,
        available: new Prisma.Decimal(0),
      })
      continue
    }

    // Conversión numérica estricta para comparación correcta
    const availableN = toNumberStrict(product.stock)
    const requiredN = toNumberStrict(item.baseQty)
    
    if (Number.isNaN(availableN) || Number.isNaN(requiredN)) {
      errors.push({
        productId: item.productId,
        productName: product.name,
        requested: item.baseQty,
        available: product.stock,
      })
      continue
    }
    
    // Comparación numérica estricta
    if (availableN < requiredN) {
      errors.push({
        productId: item.productId,
        productName: product.name,
        requested: item.baseQty,
        available: product.stock,
      })
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Obtener productos con stock bajo
 */
export async function getLowStockProducts() {
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
    },
    select: {
      id: true,
      sku: true,
      name: true,
      stock: true,
      minStock: true,
      unit: true,
    },
  })

  return products.filter((p) => p.stock <= p.minStock)
}
