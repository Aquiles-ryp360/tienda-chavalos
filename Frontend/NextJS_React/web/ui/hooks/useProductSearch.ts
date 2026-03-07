'use client'

import useSWR from 'swr'
import { useRef, useCallback, useMemo } from 'react'
import { useDebounce } from './useDebounce'

/* ── Tipos ─────────────────────────────────────────────── */

export interface ProductResult {
  id: string
  sku: string
  name: string
  unit: string
  price: number
  stock: number
  minStock: number
  isActive: boolean
  presentations?: ProductPresentation[]
}

export interface ProductPresentation {
  id: string
  name: string
  unit: string
  factorToBase: number
  priceOverride: number | null
  computedUnitPrice: number
  isDefault: boolean
  isActive: boolean
}

interface SearchResponse {
  products: ProductResult[]
  total: number
}

interface UseProductSearchOptions {
  /** Filtrar solo productos activos (default: true) */
  activeOnly?: boolean
  /** Límite de resultados (default: 30) */
  limit?: number
  /** Incluir presentaciones en la respuesta (default: false) */
  includePresentations?: boolean
  /** Filtrar productos con stock > 0 (default: false) */
  inStockOnly?: boolean
  /** Delay del debounce en ms (default: 300) */
  debounceMs?: number
  /** Intervalo de deduplicación SWR en ms (default: 60000) */
  dedupingInterval?: number
  /** Datos iniciales SSR para evitar un fetch duplicado al montar */
  fallbackData?: SearchResponse
}

/* ── Fetcher con AbortController ───────────────────────── */

/**
 * Mapa global de AbortControllers activos por clave SWR.
 * Cancela peticiones anteriores cuando el usuario escribe rápido,
 * ahorrando ancho de banda en la red local.
 */
const activeControllers = new Map<string, AbortController>()

async function searchFetcher(url: string): Promise<SearchResponse> {
  // Cancelar petición anterior para la misma clave
  const prev = activeControllers.get(url)
  if (prev) prev.abort()

  const controller = new AbortController()
  activeControllers.set(url, controller)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      credentials: 'include',
    })
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        window.location.href = '/login'
      }
      throw new Error(`HTTP ${res.status}`)
    }
    const data = await res.json()
    return {
      products: data.products || data.items || [],
      total: Number(data.total ?? 0),
    }
  } finally {
    // Limpiar si este controller sigue siendo el activo
    if (activeControllers.get(url) === controller) {
      activeControllers.delete(url)
    }
  }
}

/* ── Hook principal ────────────────────────────────────── */

export function useProductSearch(
  rawQuery: string,
  options: UseProductSearchOptions = {}
) {
  const {
    activeOnly = true,
    limit = 30,
    includePresentations = false,
    inStockOnly = false,
    debounceMs = 300,
    dedupingInterval = 60_000,
    fallbackData,
  } = options

  const debouncedQuery = useDebounce(rawQuery.trim(), debounceMs)

  // Construir la URL de búsqueda (clave SWR)
  const buildUrl = useCallback(
    (query: string, offset = 0) => {
      const params = new URLSearchParams()
      if (query) params.append('search', query)
      if (activeOnly) params.append('isActive', 'true')
      if (inStockOnly) params.append('inStockOnly', '1')
      if (includePresentations) params.append('includePresentations', '1')
      params.append('limit', String(limit))
      params.append('offset', String(offset))
      return `/api/products?${params}`
    },
    [activeOnly, includePresentations, inStockOnly, limit]
  )

  const swrKey = buildUrl(debouncedQuery, 0)

  const {
    data,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<SearchResponse>(swrKey, searchFetcher, {
    fallbackData,
    // ── Caché agresivo para LAN ──
    dedupingInterval,             // 1 min: misma búsqueda = 0ms desde RAM
    revalidateOnFocus: false,     // No revalidar al cambiar de pestaña
    revalidateOnReconnect: false, // No saturar al reconectar Wi-Fi
    revalidateOnMount: fallbackData ? false : undefined,
    revalidateIfStale: fallbackData ? false : true,
    keepPreviousData: true,       // Mantener datos anteriores (anti-parpadeo)
    errorRetryCount: 2,           // Pocos reintentos en red débil
    errorRetryInterval: 3000,     // Esperar 3s entre reintentos
    shouldRetryOnError: true,
  })

  // Ref para tracking de paginación
  const paginationRef = useRef({ skip: 0, hasMore: false })

  // Calcular productos filtrados (memoizado para estabilidad referencial)
  const products = useMemo(() => {
    let result = data?.products ?? []
    if (inStockOnly) {
      result = result.filter((p) => p.stock > 0)
    }
    if (!includePresentations) {
      result = result.map(({ presentations, ...rest }) => rest as ProductResult)
    }
    return result
  }, [data?.products, inStockOnly, includePresentations])

  const total = data?.total ?? 0
  paginationRef.current = {
    skip: products.length,
    hasMore: products.length < total,
  }

  // Indicadores de estado UX
  const isSearching = rawQuery.trim() !== debouncedQuery
  const isStale = isValidating && !!data // Tiene datos viejos, cargando nuevos

  return {
    /** Productos encontrados (filtrados según opciones) */
    products,
    /** Total de resultados en el servidor */
    total,
    /** Término de búsqueda ya debounceado */
    debouncedQuery,
    /** Primera carga (sin datos previos) */
    isLoading,
    /** Revalidando con datos previos visibles (ideal para opacity) */
    isStale,
    /** El input cambió pero el debounce no disparó aún */
    isSearching,
    /** Error de red/servidor */
    error,
    /** Si hay más páginas disponibles */
    hasMore: paginationRef.current.hasMore,
    /** Cantidad de items ya cargados */
    skip: paginationRef.current.skip,
    /** Forzar recarga */
    refresh: mutate,
  }
}
