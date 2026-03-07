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
  const productIds = [...new Set(items.map((item) => item.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, name: true, stock: true, isActive: true, unit: true },
      })
    : []
  const productsById = new Map(products.map((product) => [product.id, product]))

  for (const item of items) {
    const product = productsById.get(item.productId)

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
  const products = await prisma.$queryRaw<
    Array<{
      id: string
      sku: string
      name: string
      stock: Prisma.Decimal
      minStock: Prisma.Decimal
      unit: string
    }>
  >`
    SELECT id, sku, name, stock, "minStock", unit
    FROM products
    WHERE "isActive" = true
      AND stock <= "minStock"
    ORDER BY name ASC
  `

  return products.filter((product) => {
    const stockN = toNumberStrict(product.stock)
    const minN = toNumberStrict(product.minStock)
    return !Number.isNaN(stockN) && !Number.isNaN(minN)
  })
}
