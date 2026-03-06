    /**
     * Remove accents and special characters from text
     */
    export function removeAccents(text: string): string {
      return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^\w\s]/g, '') // Remove special characters except spaces
    }

    /**
     * Generate SKU prefix from product name
     * Optimización:
     * - NO devuelve prefijo hasta tener al menos 3 letras en la primera palabra (evita Y, YE, etc.)
     * - Si hay 2+ palabras pero la segunda aún no tiene 3 letras, mantiene solo "AAA" (estable)
     *
     * Examples:
     * "Cable eléctrico" → "CAB-ELE"
     * "Martillo" → "MAR"
     * "Clavo 2 pulgadas" → "CLA-PUL"
     */
    export function slugToSkuPrefix(name: string): string {
      if (!name || name.trim().length === 0) return ''

      const normalized = removeAccents(name.trim())

      const words = normalized.split(/\s+/).filter((w) => w.length > 0)
      if (words.length === 0) return ''

      const w1 = words[0]
      if (w1.length < 3) return '' // <- clave: no generar hasta 3 letras

      const firstWord = w1.substring(0, 3).toUpperCase()

      // 1 palabra => "AAA"
      if (words.length === 1) return firstWord

      // 2+ palabras: si 2da palabra no está lista, mantiene "AAA" para evitar spamear
      const w2 = words[1]
      if (!w2 || w2.length < 3) return firstWord

      const secondWord = w2.substring(0, 3).toUpperCase()
      return `${firstWord}-${secondWord}`
    }

    /* ==========================
      Optimización de llamadas
      ========================== */

    type CacheEntry = { value: string; ts: number }

    const DEFAULT_TTL_MS = 60_000 // 60s
    const skuCache = new Map<string, CacheEntry>()
    const inFlight = new Map<string, Promise<string | null>>()

    function normalizePrefix(prefix: string): string {
      return (prefix || '').trim().toUpperCase()
    }

    /**
     * Fetch next SKU number from API (con cache + dedupe)
     */
    export async function getNextSku(
      prefix: string,
      opts?: { ttlMs?: number; signal?: AbortSignal }
    ): Promise<string | null> {
      const p = normalizePrefix(prefix)
      if (!p) return null

      // Evita llamadas para prefijos demasiado cortos (extra seguridad)
      // "AAA" o "AAA-BBB" como mínimo
      if (p.length < 3) return null

      const ttl = opts?.ttlMs ?? DEFAULT_TTL_MS

      // 1) Cache hit
      const cached = skuCache.get(p)
      if (cached && Date.now() - cached.ts < ttl) {
        return cached.value
      }

      // 2) Si ya hay un fetch corriendo para este prefijo, reutilizarlo
      const existing = inFlight.get(p)
      if (existing) return existing

      // 3) Crear fetch y guardarlo como in-flight
      const prom = (async () => {
        try {
          const response = await fetch(
            `/api/products/next-sku?prefix=${encodeURIComponent(p)}`,
            {
              signal: opts?.signal,
              credentials: 'include',
            }
          )

          if (!response.ok) {
            if (response.status === 401 && typeof window !== 'undefined') {
              window.location.href = '/login'
            }
            console.warn(`Failed to fetch next SKU for prefix ${p}`, response.status)
            return null
          }

          const data = (await response.json()) as { nextSku?: string; sku?: string }
          const next = data.nextSku ?? data.sku
          if (!next) return null

          // Guardar cache
          skuCache.set(p, { value: next, ts: Date.now() })
          return next
        } catch (error: any) {
          // Si fue abort, no ensuciar logs
          if (error?.name !== 'AbortError') {
            console.error('Error fetching next SKU:', error)
          }
          return null
        } finally {
          inFlight.delete(p)
        }
      })()

      inFlight.set(p, prom)
      return prom
    }

    /**
     * Generate full SKU (prefix + number)
     * Optimización:
     * - si prefijo aún no está listo => devuelve '' y NO llama a la API
     * - cache evita repetir llamadas por el mismo prefijo
     */
    export async function generateFullSku(productName: string): Promise<string> {
      const prefix = slugToSkuPrefix(productName)
      if (!prefix) return ''

      const nextSku = await getNextSku(prefix)
      return nextSku || `${prefix}-001`
    }
