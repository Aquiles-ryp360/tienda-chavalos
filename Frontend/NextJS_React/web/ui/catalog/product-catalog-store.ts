'use client'

import { useSyncExternalStore } from 'react'
import type { CatalogProduct } from './product-catalog.types'

const STORAGE_KEY = 'pos-product-catalog-cache-v1'
const STORAGE_VERSION = 2

type IdleHandle = number | ReturnType<typeof globalThis.setTimeout>
type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }

interface PersistedCatalogState {
  version: number
  products: CatalogProduct[]
  isFullySynced: boolean
  lastSyncCompletedAt: number | null
}

interface ProductCatalogSaleItem {
  productId: string
  soldQty: number
  factorToBase?: number
}

export interface ProductCatalogState {
  products: CatalogProduct[]
  isHydrated: boolean
  isSyncing: boolean
  isFullySynced: boolean
  syncCursor: number
  syncedCount: number
  totalExpected: number | null
  lastSyncStartedAt: number | null
  lastSyncCompletedAt: number | null
  lastSyncError: string | null
  version: number
}

const listeners = new Set<() => void>()

let didHydrate = false
let persistHandle: IdleHandle | null = null

let state: ProductCatalogState = {
  products: [],
  isHydrated: false,
  isSyncing: false,
  isFullySynced: false,
  syncCursor: 0,
  syncedCount: 0,
  totalExpected: null,
  lastSyncStartedAt: null,
  lastSyncCompletedAt: null,
  lastSyncError: null,
  version: 0,
}

function compareProducts(a: CatalogProduct, b: CatalogProduct) {
  return (
    a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }) ||
    a.sku.localeCompare(b.sku, 'es', { sensitivity: 'base' })
  )
}

function normalizeProducts(products: CatalogProduct[]) {
  return products.map((product) => ({
    ...product,
    price: Number(product.price ?? 0),
    stock: Number(product.stock ?? 0),
    minStock: Number(product.minStock ?? 0),
    presentations: product.presentations?.map((presentation) => ({
      ...presentation,
      factorToBase: Number(presentation.factorToBase ?? 1),
      priceOverride:
        presentation.priceOverride === null || presentation.priceOverride === undefined
          ? null
          : Number(presentation.priceOverride),
      computedUnitPrice: Number(presentation.computedUnitPrice ?? 0),
    })),
  }))
}

function roundCatalogNumber(value: number, decimals: number = 3) {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function mergeProducts(current: CatalogProduct[], incoming: CatalogProduct[]) {
  if (incoming.length === 0) return current

  const productMap = new Map<string, CatalogProduct>(current.map((product) => [product.id, product]))

  for (const product of normalizeProducts(incoming)) {
    productMap.set(product.id, product)
  }

  return Array.from(productMap.values()).sort(compareProducts)
}

function schedulePersist() {
  if (typeof window === 'undefined' || persistHandle !== null) return

  const idleWindow = window as IdleWindow
  const persistNow = () => {
    persistHandle = null

    try {
      const payload: PersistedCatalogState = {
        version: STORAGE_VERSION,
        products: state.products,
        isFullySynced: state.isFullySynced,
        lastSyncCompletedAt: state.lastSyncCompletedAt,
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
    } catch (error) {
      console.warn('No se pudo persistir el catálogo local', error)
    }
  }

  if (typeof idleWindow.requestIdleCallback === 'function') {
    persistHandle = idleWindow.requestIdleCallback(() => persistNow(), { timeout: 600 }) as IdleHandle
    return
  }

  persistHandle = globalThis.setTimeout(persistNow, 250)
}

function emit() {
  listeners.forEach((listener) => listener())
}

function updateState(
  updater: (current: ProductCatalogState) => ProductCatalogState,
  options?: { persist?: boolean }
) {
  const nextState = updater(state)

  if (nextState === state) return

  state = nextState

  if (options?.persist) {
    schedulePersist()
  }

  emit()
}

export function getProductCatalogSnapshot() {
  return state
}

export function useProductCatalogState() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => state
  )
}

export function hydrateProductCatalogStore() {
  if (didHydrate || typeof window === 'undefined') {
    if (!state.isHydrated) {
      updateState((current) => ({ ...current, isHydrated: true }))
    }
    return
  }

  didHydrate = true

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      updateState((current) => ({ ...current, isHydrated: true }))
      return
    }

    const parsed = JSON.parse(raw) as PersistedCatalogState
    if (parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.products)) {
      updateState((current) => ({ ...current, isHydrated: true }))
      return
    }

    updateState((current) => {
      const mergedProducts = mergeProducts(current.products, parsed.products)

      return {
        ...current,
        products: mergedProducts,
        isHydrated: true,
        isFullySynced: Boolean(parsed.isFullySynced),
        syncedCount: mergedProducts.length,
        totalExpected: mergedProducts.length || current.totalExpected,
        lastSyncCompletedAt: parsed.lastSyncCompletedAt ?? current.lastSyncCompletedAt,
        version: current.version + 1,
      }
    })
  } catch (error) {
    console.warn('No se pudo hidratar el catálogo local', error)
    updateState((current) => ({ ...current, isHydrated: true }))
  }
}

export function seedProductCatalog(products: CatalogProduct[]) {
  if (!products.length) return

  updateState(
    (current) => {
      const mergedProducts = mergeProducts(current.products, products)
      if (mergedProducts === current.products) return current

      return {
        ...current,
        products: mergedProducts,
        syncedCount: Math.max(current.syncedCount, mergedProducts.length),
        totalExpected: current.totalExpected ?? mergedProducts.length,
        version: current.version + 1,
      }
    },
    { persist: true }
  )
}

export function mergeIntoProductCatalog(products: CatalogProduct[]) {
  if (!products.length) return

  updateState(
    (current) => {
      const mergedProducts = mergeProducts(current.products, products)

      return {
        ...current,
        products: mergedProducts,
        syncedCount: Math.max(current.syncedCount, mergedProducts.length),
        totalExpected: Math.max(current.totalExpected ?? 0, mergedProducts.length),
        version: current.version + 1,
      }
    },
    { persist: true }
  )
}

export function applySaleToProductCatalog(items: ProductCatalogSaleItem[]) {
  if (!items.length) return

  const stockDeltaByProduct = new Map<string, number>()

  for (const item of items) {
    const soldQty = Number(item.soldQty)
    const factorToBase = Number(item.factorToBase ?? 1)

    if (!item.productId || !Number.isFinite(soldQty) || soldQty <= 0) continue
    if (!Number.isFinite(factorToBase) || factorToBase <= 0) continue

    const baseQty = roundCatalogNumber(soldQty * factorToBase, 3)
    const currentDelta = stockDeltaByProduct.get(item.productId) ?? 0
    stockDeltaByProduct.set(
      item.productId,
      roundCatalogNumber(currentDelta + baseQty, 3)
    )
  }

  if (stockDeltaByProduct.size === 0) return

  updateState(
    (current) => {
      if (current.products.length === 0) return current

      let changed = false
      const nextProducts = current.products.map((product) => {
        const delta = stockDeltaByProduct.get(product.id)
        if (delta === undefined) return product

        const currentStock = Number(product.stock ?? 0)
        if (!Number.isFinite(currentStock)) return product

        const nextStock = roundCatalogNumber(currentStock - delta, 3)
        if (nextStock === currentStock) return product

        changed = true
        return {
          ...product,
          stock: nextStock,
        }
      })

      if (!changed) return current

      return {
        ...current,
        products: nextProducts,
        version: current.version + 1,
      }
    },
    { persist: true }
  )
}

export function beginProductCatalogSync() {
  updateState((current) => ({
    ...current,
    isSyncing: true,
    syncCursor: 0,
    totalExpected: current.totalExpected ?? current.products.length ?? null,
    lastSyncStartedAt: Date.now(),
    lastSyncError: null,
  }))
}

export function updateProductCatalogSyncProgress(input: {
  syncCursor: number
  totalExpected: number | null
}) {
  updateState((current) => ({
    ...current,
    isSyncing: true,
    syncCursor: input.syncCursor,
    syncedCount: Math.max(current.syncedCount, input.syncCursor),
    totalExpected: input.totalExpected,
  }))
}

export function completeProductCatalogSync(seenIds: Set<string>) {
  updateState(
    (current) => {
      const prunedProducts = current.products
        .filter((product) => seenIds.has(product.id))
        .sort(compareProducts)

      return {
        ...current,
        products: prunedProducts,
        isSyncing: false,
        isFullySynced: true,
        syncCursor: prunedProducts.length,
        syncedCount: prunedProducts.length,
        totalExpected: prunedProducts.length,
        lastSyncCompletedAt: Date.now(),
        lastSyncError: null,
        version: current.version + 1,
      }
    },
    { persist: true }
  )
}

export function failProductCatalogSync(message: string) {
  updateState((current) => ({
    ...current,
    isSyncing: false,
    lastSyncError: message,
  }))
}
