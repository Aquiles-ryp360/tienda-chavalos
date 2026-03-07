'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import useSWR from 'swr'
import { useDebounce } from '@/ui/hooks/useDebounce'
import {
  ProductsRequestError,
  fetchProductsPage,
} from '@/ui/catalog/product-catalog-client'
import {
  hydrateProductCatalogStore,
  mergeIntoProductCatalog,
  seedProductCatalog,
  useProductCatalogState,
} from '@/ui/catalog/product-catalog-store'
import type {
  CatalogProduct,
  CatalogQueryOptions,
  CatalogSearchResponse,
} from '@/ui/catalog/product-catalog.types'
import { startBackgroundCatalogSync } from '@/ui/hooks/useBackgroundCatalogSync'

const FALLBACK_ABORT_KEY = 'smart-product-search'

interface UseSmartProductSearchOptions {
  activeOnly?: boolean
  inStockOnly?: boolean
  includePresentations?: boolean
  limit?: number
  debounceMs?: number
  bootstrapProducts?: CatalogProduct[]
  bootstrapTotal?: number
  remoteFallbackThreshold?: number
  enableEmptyQueryFallback?: boolean
}

interface LocalSearchResult {
  products: CatalogProduct[]
  total: number
}

function normalizeSearchValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function buildSearchableText(product: CatalogProduct) {
  const presentationText =
    product.presentations?.map((presentation) => `${presentation.name} ${presentation.unit}`).join(' ') ?? ''

  return normalizeSearchValue(
    `${product.sku} ${product.name} ${product.description ?? ''} ${presentationText}`
  )
}

function filterLocalProducts(
  products: CatalogProduct[],
  search: string,
  options: UseSmartProductSearchOptions
): LocalSearchResult {
  const normalizedSearch = normalizeSearchValue(search)
  const searchTokens = normalizedSearch ? normalizedSearch.split(' ') : []

  const filtered = products.filter((product) => {
    if (options.activeOnly && !product.isActive) return false
    if (options.inStockOnly && Number(product.stock) <= 0) return false
    if (searchTokens.length === 0) return true

    const searchableText = buildSearchableText(product)
    return searchTokens.every((token) => searchableText.includes(token))
  })

  const normalizedProducts = filtered.map((product) =>
    options.includePresentations ? product : ({ ...product, presentations: undefined })
  )

  return {
    products: normalizedProducts,
    total: filtered.length,
  }
}

function mergeVisibleProducts(
  localProducts: CatalogProduct[],
  remoteProducts: CatalogProduct[],
  limit: number
) {
  const productMap = new Map<string, CatalogProduct>()

  for (const product of localProducts) {
    productMap.set(product.id, product)
  }

  for (const product of remoteProducts) {
    if (!productMap.has(product.id)) {
      productMap.set(product.id, product)
    }
  }

  return Array.from(productMap.values()).slice(0, limit)
}

function redirectToLogin() {
  if (typeof window !== 'undefined') {
    window.location.href = '/login'
  }
}

export function useSmartProductSearch(
  rawQuery: string,
  options: UseSmartProductSearchOptions = {}
) {
  const {
    activeOnly = true,
    inStockOnly = false,
    includePresentations = false,
    limit = 30,
    debounceMs = 300,
    bootstrapProducts = [],
    bootstrapTotal,
    remoteFallbackThreshold = 0,
    enableEmptyQueryFallback = true,
  } = options

  const catalogState = useProductCatalogState()
  const liveQuery = rawQuery.trim()
  const debouncedQuery = useDebounce(liveQuery, debounceMs)
  const [visibleLimit, setVisibleLimit] = useState(limit)

  useEffect(() => {
    hydrateProductCatalogStore()
  }, [])

  useEffect(() => {
    if (!bootstrapProducts.length) return
    seedProductCatalog(bootstrapProducts)
  }, [bootstrapProducts])

  const catalogProducts =
    catalogState.products.length > 0 ? catalogState.products : bootstrapProducts

  useEffect(() => {
    setVisibleLimit(limit)
  }, [limit, liveQuery])

  const localSearchOptions = useMemo<UseSmartProductSearchOptions>(
    () => ({
      activeOnly,
      inStockOnly,
      includePresentations,
      limit: visibleLimit,
    }),
    [activeOnly, inStockOnly, includePresentations, visibleLimit]
  )

  const liveLocalResults = useMemo(
    () => filterLocalProducts(catalogProducts, liveQuery, localSearchOptions),
    [catalogProducts, liveQuery, localSearchOptions]
  )

  const debouncedLocalResults = useMemo(
    () => filterLocalProducts(catalogProducts, debouncedQuery, localSearchOptions),
    [catalogProducts, debouncedQuery, localSearchOptions]
  )

  const shouldFallback =
    (debouncedQuery.length > 0 || enableEmptyQueryFallback) &&
    !catalogState.isFullySynced &&
    (
      debouncedLocalResults.total <= remoteFallbackThreshold ||
      debouncedLocalResults.total < visibleLimit
    )

  const fallbackRequest = useMemo<CatalogQueryOptions | null>(() => {
    if (!shouldFallback) return null

    return {
      search: debouncedQuery || undefined,
      activeOnly,
      inStockOnly,
      includePresentations,
      limit: visibleLimit,
      offset: 0,
    }
  }, [activeOnly, debouncedQuery, includePresentations, inStockOnly, shouldFallback, visibleLimit])

  const {
    data: remoteData,
    error: remoteError,
    isLoading: isFallbackLoading,
    isValidating: isFallbackValidating,
    mutate: mutateRemoteSearch,
  } = useSWR<CatalogSearchResponse, ProductsRequestError>(
    fallbackRequest ? ['smart-product-search', fallbackRequest] : null,
    ([, request]: readonly [string, CatalogQueryOptions]) =>
      fetchProductsPage(request, {
        abortKey: FALLBACK_ABORT_KEY,
        retries: 2,
      }),
    {
      dedupingInterval: 15_000,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      shouldRetryOnError: (error) => error.status !== 401,
      errorRetryCount: 2,
      errorRetryInterval: 1_500,
    }
  )

  useEffect(() => {
    if (!remoteData?.products?.length) return
    mergeIntoProductCatalog(remoteData.products)
  }, [remoteData])

  useEffect(() => {
    if (remoteError?.status === 401) {
      redirectToLogin()
    }
  }, [remoteError])

  const visibleRemoteProducts =
    liveQuery === debouncedQuery ? (remoteData?.products ?? []).slice(0, visibleLimit) : []

  const products = useMemo(
    () =>
      mergeVisibleProducts(
        liveLocalResults.products.slice(0, visibleLimit),
        visibleRemoteProducts,
        visibleLimit
      ),
    [liveLocalResults.products, visibleLimit, visibleRemoteProducts]
  )

  const totalWithBootstrap =
    liveQuery.length === 0 ? Math.max(liveLocalResults.total, bootstrapTotal ?? 0) : liveLocalResults.total

  const total =
    liveQuery === debouncedQuery && remoteData
      ? Math.max(totalWithBootstrap, remoteData.total)
      : totalWithBootstrap

  const hasMore =
    total > products.length ||
    (!catalogState.isFullySynced && products.length >= visibleLimit)

  const loadMore = useCallback(() => {
    setVisibleLimit((current) => current + limit)
  }, [limit])

  const refresh = useCallback(async () => {
    try {
      const freshSearch = await fetchProductsPage(
        {
          search: debouncedQuery || undefined,
          activeOnly,
          inStockOnly,
          includePresentations,
          limit: visibleLimit,
          offset: 0,
        },
        {
          abortKey: FALLBACK_ABORT_KEY,
          retries: 1,
        }
      )

      if (freshSearch.products.length > 0) {
        mergeIntoProductCatalog(freshSearch.products)
      }

      if (debouncedQuery) {
        await mutateRemoteSearch(freshSearch, { revalidate: false })
      }
    } catch (error) {
      if (error instanceof ProductsRequestError && error.status === 401) {
        redirectToLogin()
      } else {
        console.warn('No se pudo refrescar la búsqueda activa', error)
      }
    }

    void startBackgroundCatalogSync({
      activeOnly: false,
      inStockOnly: false,
      includePresentations: true,
      force: true,
    }).catch((error) => {
      if (error instanceof ProductsRequestError && error.status === 401) {
        redirectToLogin()
      }
    })
  }, [
    activeOnly,
    debouncedQuery,
    includePresentations,
    inStockOnly,
    mutateRemoteSearch,
    visibleLimit,
  ])

  return {
    products,
    catalogProducts,
    catalogVersion: catalogState.version,
    total,
    debouncedQuery,
    isLoading:
      (!catalogState.isHydrated && bootstrapProducts.length === 0) ||
      (products.length === 0 && shouldFallback && isFallbackLoading),
    isStale:
      liveQuery === debouncedQuery &&
      isFallbackValidating &&
      liveLocalResults.total > 0,
    isSearching: liveQuery !== debouncedQuery,
    isFallbackLoading,
    isFullySynced: catalogState.isFullySynced,
    isSyncingCatalog: catalogState.isSyncing,
    hasMore,
    skip: products.length,
    loadMore,
    error: remoteError ?? null,
    refresh,
  }
}
