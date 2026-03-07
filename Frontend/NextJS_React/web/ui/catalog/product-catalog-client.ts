import type { CatalogQueryOptions, CatalogSearchResponse } from './product-catalog.types'

const DEFAULT_TIMEOUT_MS = 12_000
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504])

const activeAbortControllers = new Map<string, AbortController>()

export const DEFAULT_CATALOG_SYNC_CHUNK_SIZE = 50

export class ProductsRequestError extends Error {
  status?: number
  retryable: boolean

  constructor(message: string, options?: { status?: number; retryable?: boolean }) {
    super(message)
    this.name = 'ProductsRequestError'
    this.status = options?.status
    this.retryable = options?.retryable ?? false
  }
}

export function buildProductsUrl({
  search,
  activeOnly,
  inStockOnly,
  includePresentations,
  limit = 50,
  offset = 0,
}: CatalogQueryOptions) {
  const params = new URLSearchParams()
  const isActiveFilter = activeOnly === true ? 'true' : null

  if (search) params.set('search', search)
  // `activeOnly=false` means "all products", not "only inactive products".
  if (isActiveFilter) params.set('isActive', isActiveFilter)
  if (inStockOnly) params.set('inStockOnly', '1')
  if (includePresentations) params.set('includePresentations', '1')
  params.set('limit', String(limit))
  params.set('offset', String(offset))

  return `/api/products?${params.toString()}`
}

interface FetchProductsOptions {
  signal?: AbortSignal
  timeoutMs?: number
  retries?: number
  abortKey?: string
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError'
}

function isRetryableStatus(status: number) {
  return RETRYABLE_STATUS_CODES.has(status)
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizeProductsResponse(data: any): CatalogSearchResponse {
  return {
    products: data.products || data.items || [],
    total: Number(data.total ?? data.products?.length ?? data.items?.length ?? 0),
  }
}

function createManagedController(
  timeoutMs: number,
  signal?: AbortSignal,
  abortKey?: string
) {
  const controller = new AbortController()
  const cleanups: Array<() => void> = []

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      const abortFromParent = () => controller.abort(signal.reason)
      signal.addEventListener('abort', abortFromParent, { once: true })
      cleanups.push(() => signal.removeEventListener('abort', abortFromParent))
    }
  }

  if (abortKey) {
    activeAbortControllers.get(abortKey)?.abort('superseded')
    activeAbortControllers.set(abortKey, controller)
    cleanups.push(() => {
      if (activeAbortControllers.get(abortKey) === controller) {
        activeAbortControllers.delete(abortKey)
      }
    })
  }

  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs)
  cleanups.push(() => clearTimeout(timeoutId))

  return {
    controller,
    cleanup() {
      cleanups.forEach((dispose) => dispose())
    },
  }
}

export async function fetchProductsPage(
  query: CatalogQueryOptions,
  options: FetchProductsOptions = {}
): Promise<CatalogSearchResponse> {
  const {
    signal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    retries = 2,
    abortKey,
  } = options

  const url = buildProductsUrl(query)

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { controller, cleanup } = createManagedController(timeoutMs, signal, abortKey)

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'include',
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new ProductsRequestError(`HTTP ${response.status}`, {
          status: response.status,
          retryable: isRetryableStatus(response.status),
        })
      }

      const data = await response.json()
      return normalizeProductsResponse(data)
    } catch (error) {
      const requestError =
        error instanceof ProductsRequestError
          ? error
          : isAbortError(error)
            ? new ProductsRequestError('AbortError', { retryable: false })
            : new ProductsRequestError('NetworkError', { retryable: true })

      if (!requestError.retryable || attempt === retries || isAbortError(error)) {
        throw requestError
      }

      const backoffMs = 500 * (attempt + 1)
      await wait(backoffMs)
    } finally {
      cleanup()
    }
  }

  throw new ProductsRequestError('No se pudo completar la petición', { retryable: false })
}
