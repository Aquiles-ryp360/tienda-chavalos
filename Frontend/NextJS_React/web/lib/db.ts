import 'server-only'

export type { Sale, Product, SaleItem, StockMovement, User, ProductPresentation } from '@prisma/client'
export { PaymentMethod, StockMovementType, UserRole, ProductUnit, Prisma } from '@prisma/client'

// Export Decimal desde runtime para evitar errores de tipo con Prisma v6
export { Decimal, type DecimalJsLike } from '@prisma/client/runtime/library'

// CustomerDocType - enum manual (no existe en Prisma schema actual)
export const CustomerDocType = {
  RUC: 'RUC',
  CEDULA: 'CEDULA',
  PASAPORTE: 'PASAPORTE',
  OTRO: 'OTRO',
} as const

export type CustomerDocType = (typeof CustomerDocType)[keyof typeof CustomerDocType]
