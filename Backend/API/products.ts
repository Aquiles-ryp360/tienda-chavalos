import { prisma } from '@web/lib/prisma'
import type { Product, ProductPresentation } from '@web/lib/db'
import { ProductUnit, Prisma } from '@web/lib/db'

function normalizeProductName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export interface CreateProductInput {
  sku: string
  name: string
  description?: string
  unit: ProductUnit
  price: number
  stock: number
  minStock?: number
}

export interface UpdateProductInput {
  sku?: string
  name?: string
  description?: string
  unit?: ProductUnit
  price?: number
  stock?: number
  minStock?: number
  isActive?: boolean
}

export interface SearchProductsQuery {
  search?: string
  isActive?: boolean
  limit?: number
  offset?: number
}

export interface ProductWithPresentations extends Omit<Product, 'price' | 'stock' | 'minStock'> {
  price: number
  stock: number
  minStock: number
  presentations: Array<{
    id: string
    name: string
    unit: ProductUnit
    factorToBase: number
    priceOverride: number | null
    computedUnitPrice: number
    isDefault: boolean
    isActive: boolean
  }>
}

/**
 * Crear producto
 */
export async function createProduct(input: CreateProductInput): Promise<Product> {
  const normalizedName = normalizeProductName(input.name)
  const existing = await prisma.product.findFirst({
    where: { name: { equals: normalizedName, mode: 'insensitive' } },
    select: { id: true, sku: true, name: true, isActive: true },
  })
  if (existing) {
    const err: any = new Error('DUPLICATE_PRODUCT_NAME')
    err.code = 'DUPLICATE_PRODUCT_NAME'
    err.existing = existing
    throw err
  }

  // Crear producto y, si no hay presentaciones, crear una default automáticamente
  return await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        ...input,
        name: normalizedName,
        minStock: new Prisma.Decimal(input.minStock ?? 5),
        price: new Prisma.Decimal(input.price),
        stock: new Prisma.Decimal(input.stock),
      },
    })

    // Crear presentación por defecto (factor 1, unit=name=product.unit, isDefault=true, isActive=true, priceOverride=null)
    await tx.productPresentation.create({
      data: {
        productId: product.id,
        name: product.unit, // usar unidad como nombre por defecto
        unit: product.unit,
        factorToBase: new Prisma.Decimal(1),
        priceOverride: null,
        isDefault: true,
        isActive: true,
      },
    })

    return product
  })
}

/**
 * Obtener producto por ID con presentaciones
 */
export async function getProductById(
  id: string
): Promise<ProductWithPresentations | null> {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      presentations: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          unit: true,
          factorToBase: true,
          priceOverride: true,
          isDefault: true,
          isActive: true,
        },
      },
    },
  })

  if (!product) return null

  const result: ProductWithPresentations = {
    id: product.id,
    sku: product.sku,
    name: product.name,
    description: product.description,
    unit: product.unit,
    price: Number(product.price),
    stock: Number(product.stock),
    minStock: Number(product.minStock),
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    presentations: product.presentations.map((p) => {
      const computedUnitPrice =
        p.priceOverride !== null
          ? Number(p.priceOverride)
          : Number(product.price) * Number(p.factorToBase)

      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        factorToBase: Number(p.factorToBase),
        priceOverride: p.priceOverride !== null ? Number(p.priceOverride) : null,
        computedUnitPrice,
        isDefault: p.isDefault,
        isActive: p.isActive,
      }
    }),
  }

  // Si no tiene presentaciones activas, devolver una presentación virtual (fallback)
  if (result.presentations.length === 0) {
    result.presentations = [
      {
        id: 'virtual-default',
        name: result.unit,
        unit: result.unit,
        factorToBase: 1,
        priceOverride: null,
        computedUnitPrice: Number(result.price) * 1,
        isDefault: true,
        isActive: true,
      },
    ]
  }

  return result
}

/**
 * Buscar productos con presentaciones
 */
export async function searchProducts(query: SearchProductsQuery) {
  const where: any = {}

  if (query.isActive !== undefined) {
    where.isActive = query.isActive
  }

  if (query.search) {
    where.OR = [
      { sku: { contains: query.search, mode: 'insensitive' } },
      { name: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: {
        presentations: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            unit: true,
            factorToBase: true,
            priceOverride: true,
            isDefault: true,
            isActive: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      take: query.limit ?? 50,
      skip: query.offset ?? 0,
    }),
    prisma.product.count({ where }),
  ])

  const serialized = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: p.name,
    description: p.description,
    unit: p.unit,
    price: Number(p.price),
    stock: Number(p.stock),
    minStock: Number(p.minStock),
    isActive: p.isActive,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    presentations: p.presentations.map((pres) => {
      const computedUnitPrice =
        pres.priceOverride !== null
          ? Number(pres.priceOverride)
          : Number(p.price) * Number(pres.factorToBase)

      return {
        id: pres.id,
        name: pres.name,
        unit: pres.unit,
        factorToBase: Number(pres.factorToBase),
        priceOverride: pres.priceOverride ? Number(pres.priceOverride) : null,
        computedUnitPrice,
        isDefault: pres.isDefault,
        isActive: pres.isActive,
      }
    }),
  })) as ProductWithPresentations[]

  // Insertar presentación virtual (fallback) para productos sin presentaciones
  for (const prod of serialized) {
    if (!prod.presentations || prod.presentations.length === 0) {
      prod.presentations = [
        {
          id: 'virtual-default',
          name: prod.unit,
          unit: prod.unit,
          factorToBase: 1,
          priceOverride: null,
          computedUnitPrice: Number(prod.price) * 1,
          isDefault: true,
          isActive: true,
        },
      ]
    }
  }

  return { products: serialized, total }
}

/**
 * Actualizar producto
 */
export async function updateProduct(
  id: string,
  input: UpdateProductInput
): Promise<Product> {
  if (input.name !== undefined) {
    const normalizedName = normalizeProductName(input.name)
    const existing = await prisma.product.findFirst({
      where: {
        id: { not: id },
        name: { equals: normalizedName, mode: 'insensitive' },
      },
      select: { id: true, sku: true, name: true, isActive: true },
    })
    if (existing) {
      const err: any = new Error('DUPLICATE_PRODUCT_NAME')
      err.code = 'DUPLICATE_PRODUCT_NAME'
      err.existing = existing
      throw err
    }
    // Guardar nombre normalizado
    input = { ...input, name: normalizedName }
  }
  const data: any = { ...input }
  if (input.price !== undefined) data.price = new Prisma.Decimal(input.price)
  if (input.stock !== undefined) data.stock = new Prisma.Decimal(input.stock)
  if (input.minStock !== undefined) data.minStock = new Prisma.Decimal(input.minStock)

  return await prisma.product.update({
    where: { id },
    data,
  })
}

/**
 * Eliminar producto (soft delete)
 */
export async function deleteProduct(id: string): Promise<Product> {
  return await prisma.product.update({
    where: { id },
    data: { isActive: false },
  })
}
/**
 * Crear o actualizar presentación de producto
 */
export async function createProductPresentation(input: {
  productId: string
  name: string
  unit: ProductUnit
  factorToBase: number
  priceOverride?: number
  isDefault?: boolean
}) {
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
  })

  if (!product) {
    throw new Error(`Producto ${input.productId} no encontrado`)
  }

  // Si es default, desactivar otros defaults
  if (input.isDefault) {
    await prisma.productPresentation.updateMany({
      where: { productId: input.productId, isDefault: true },
      data: { isDefault: false },
    })
  }

  const presentation = await prisma.productPresentation.upsert({
    where: {
      productId_name: {
        productId: input.productId,
        name: input.name,
      },
    },
    create: {
      productId: input.productId,
      name: input.name,
      unit: input.unit,
      factorToBase: new Prisma.Decimal(input.factorToBase),
      priceOverride:
        input.priceOverride !== undefined && input.priceOverride !== null
          ? new Prisma.Decimal(input.priceOverride)
          : null,
      isDefault: input.isDefault || false,
      isActive: true,
    },
    update: {
      unit: input.unit,
      factorToBase: new Prisma.Decimal(input.factorToBase),
      priceOverride:
        input.priceOverride !== undefined && input.priceOverride !== null
          ? new Prisma.Decimal(input.priceOverride)
          : null,
      isDefault: input.isDefault || false,
    },
  })  

  return {
    id: presentation.id,
    name: presentation.name,
    unit: presentation.unit,
    factorToBase: Number(presentation.factorToBase),
    priceOverride: presentation.priceOverride ? Number(presentation.priceOverride) : null,
    isDefault: presentation.isDefault,
    isActive: presentation.isActive,
  }
}

/**
 * Eliminar presentación de producto
 */
export async function deleteProductPresentation(presentationId: string) {
  const presentation = await prisma.productPresentation.findUnique({
    where: { id: presentationId },
  })

  if (!presentation) {
    throw new Error(`Presentación ${presentationId} no encontrada`)
  }

  await prisma.productPresentation.update({
    where: { id: presentationId },
    data: { isActive: false },
  })

  return { success: true }
}

export async function suggestProducts(query: { search: string; isActive?: boolean; limit?: number }) {
  const where: any = {}

  if (query.isActive !== undefined) where.isActive = query.isActive

  const q = query.search?.trim()
  if (q) {
    where.OR = [{ sku: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }]
  }

  const items = await prisma.product.findMany({
    where,
    select: { id: true, sku: true, name: true, isActive: true },
    orderBy: { name: 'asc' },
    take: query.limit ?? 8,
  })

  return { items }
}
