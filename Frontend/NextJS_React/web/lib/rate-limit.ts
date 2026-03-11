/**
 * Rate Limiter en memoria — apropiado para instancia única en LAN de la ferretería.
 * Para multi-instancia (Docker swarm, etc.) migrar a @upstash/ratelimit + Redis.
 *
 * Estrategia: ventana deslizante por IP. Máx 5 intentos de login en 15 minutos.
 * Tras login exitoso, el contador se resetea con resetRateLimit().
 */

interface AttemptRecord {
  count: number
  firstAttemptAt: number
}

/**
 * Almacenamiento en memoria simple para evitar dependencia de lru-cache en build.
 * Se limpia automáticamente cuando la entrada expira al consultarse.
 */
const store = new Map<string, AttemptRecord>()

const WINDOW_MS = 15 * 60 * 1000  // 15 minutos
const MAX_ATTEMPTS = 5             // intentos fallidos máximos

/**
 * Comprueba si la IP supera el límite de intentos.
 * @returns true si el intento está permitido, false si debe bloquearse (HTTP 429)
 */
export function checkRateLimit(ip: string, max = MAX_ATTEMPTS): boolean {
  const now = Date.now()
  const record = store.get(ip)

  if (!record) {
    store.set(ip, { count: 1, firstAttemptAt: now })
    return true
  }

  // Si la ventana expiró, reiniciar contador
  if (now - record.firstAttemptAt > WINDOW_MS) {
    store.set(ip, { count: 1, firstAttemptAt: now })
    return true
  }

  if (record.count >= max) {
    return false // bloqueado
  }

  record.count += 1
  return true
}

/**
 * Resetea el contador para la IP dada.
 * Llamar tras un login exitoso para no penalizar al usuario legítimo.
 */
export function resetRateLimit(ip: string): void {
  store.delete(ip)
}

/**
 * Devuelve los segundos que faltan para que expire el bloqueo de la IP.
 */
export function getRateLimitRetryAfter(ip: string): number {
  const record = store.get(ip)
  if (!record) return 0
  const elapsed = Date.now() - record.firstAttemptAt
  return Math.ceil((WINDOW_MS - elapsed) / 1000)
}
