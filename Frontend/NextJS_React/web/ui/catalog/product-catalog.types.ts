export interface CatalogProductPresentation {
  id: string
  name: string
  unit: string
  factorToBase: number
  priceOverride: number | null
  computedUnitPrice: number
  isDefault: boolean
  isActive: boolean
}

export interface CatalogProduct {
  id: string
  sku: string
  name: string
  description?: string | null
  unit: string
  price: number
  stock: number
  minStock: number
  isActive: boolean
  presentations?: CatalogProductPresentation[]
}

export interface CatalogSearchResponse {
  products: CatalogProduct[]
  total: number
}

export interface CatalogQueryOptions {
  search?: string
  // `true` => solo activos. `false`/`undefined` => catálogo completo.
  activeOnly?: boolean
  inStockOnly?: boolean
  includePresentations?: boolean
  limit?: number
  offset?: number
}
