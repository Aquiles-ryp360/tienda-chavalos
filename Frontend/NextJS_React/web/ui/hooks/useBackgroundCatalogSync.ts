'use client'

import { useEffect, useRef } from 'react'
import {
  DEFAULT_CATALOG_SYNC_CHUNK_SIZE,
  ProductsRequestError,
  fetchProductsPage,
} from '@/ui/catalog/product-catalog-client'
import {
  beginProductCatalogSync,
  completeProductCatalogSync,
  failProductCatalogSync,
  getProductCatalogSnapshot,
  hydrateProductCatalogStore,
  mergeIntoProductCatalog,
  seedProductCatalog,
  updateProductCatalogSyncProgress,
  useProductCatalogState,
} from '@/ui/catalog/product-catalog-store'
import type { CatalogProduct } from '@/ui/catalog/product-catalog.types'

const DEFAULT_MIN_RESTART_INTERVAL_MS = 15_000
type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number
  }

interface BackgroundCatalogSyncOptions {
  enabled?: boolean
  initialProducts?: CatalogProduct[]
  activeOnly?: boolean
  inStockOnly?: boolean
  includePresentations?: boolean
  chunkSize?: number
  maxRetries?: number
  minRestartIntervalMs?: number
  force?: boolean
}

let activeSyncPromise: Promise<void> | null = null

function waitForIdle(timeout = 250) {
  if (typeof window === 'undefined') {
    return Promise.resolve()
  }

  const idleWindow = window as IdleWindow

  return new Promise<void>((resolve) => {
    if (typeof idleWindow.requestIdleCallback === 'function') {
      idleWindow.requestIdleCallback(() => resolve(), { timeout })
      return
    }

    globalThis.setTimeout(resolve, 32)
  })
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

export async function startBackgroundCatalogSync(
  options: BackgroundCatalogSyncOptions = {}
) {
  const {
    activeOnly = false,
    inStockOnly = false,
    includePresentations = true,
    chunkSize = DEFAULT_CATALOG_SYNC_CHUNK_SIZE,
    maxRetries = 2,
    minRestartIntervalMs = DEFAULT_MIN_RESTART_INTERVAL_MS,
    force = false,
  } = options

  const snapshot = getProductCatalogSnapshot()
  const now = Date.now()

  if (activeSyncPromise) {
    return activeSyncPromise
  }

  if (
    !force &&
    snapshot.lastSyncStartedAt &&
    now - snapshot.lastSyncStartedAt < minRestartIntervalMs
  ) {
    return Promise.resolve()
  }

  activeSyncPromise = (async () => {
    beginProductCatalogSync()

    const seenIds = new Set<string>()
    let offset = 0
    let totalExpected: number | null = null

    try {
      while (true) {
        await waitForIdle()

        const page = await fetchProductsPage(
          {
            activeOnly,
            inStockOnly,
            includePresentations,
            limit: chunkSize,
            offset,
          },
          { retries: maxRetries }
        )

        if (page.products.length > 0) {
          mergeIntoProductCatalog(page.products)
          page.products.forEach((product) => seenIds.add(product.id))
        }

        offset += page.products.length
        totalExpected = page.total

        updateProductCatalogSyncProgress({
          syncCursor: offset,
          totalExpected,
        })

        if (page.products.length === 0 || offset >= page.total) {
          break
        }
      }

      completeProductCatalogSync(seenIds)
    } catch (error) {
      const message =
        error instanceof ProductsRequestError
          ? error.message
          : 'No se pudo sincronizar el catálogo'

      failProductCatalogSync(message)

      if (error instanceof ProductsRequestError && error.status === 401) {
        redirectToLogin()
      }

      throw error
    } finally {
      activeSyncPromise = null
    }
  })()

  return activeSyncPromise
}

export function useBackgroundCatalogSync(options: BackgroundCatalogSyncOptions = {}) {
  const {
    enabled = true,
    initialProducts = [],
  } = options

  const hasStartedRef = useRef(false)
  const catalogState = useProductCatalogState()

  useEffect(() => {
    hydrateProductCatalogStore()
  }, [])

  useEffect(() => {
    if (!initialProducts.length) return
    seedProductCatalog(initialProducts)
  }, [initialProducts])

  useEffect(() => {
    if (!enabled || !catalogState.isHydrated || hasStartedRef.current) return

    hasStartedRef.current = true

    void startBackgroundCatalogSync(options).catch((error) => {
      if (error instanceof ProductsRequestError && error.status === 401) {
        redirectToLogin()
      }
    })
  }, [catalogState.isHydrated, enabled, options])

  return {
    isSyncing: catalogState.isSyncing,
    isFullySynced: catalogState.isFullySynced,
    syncedCount: catalogState.syncedCount,
    totalExpected: catalogState.totalExpected,
    lastSyncError: catalogState.lastSyncError,
  }
}
