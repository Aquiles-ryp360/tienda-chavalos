import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'
import { UserRole } from '@prisma/client'
import { auth as googleAuth } from '@/lib/auth-google'

export interface SessionUser {
  id: string
  username: string
  role: UserRole
  fullName: string
}

const SESSION_COOKIE_NAME = 'ferre_session'

// ── Validación de SESSION_SECRET en arranque ────────────────────────────────
// Falla inmediatamente en la primera solicitud si el secret no es seguro.
// Para generar uno válido: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error(
      '[auth-session] SESSION_SECRET no está definido en las variables de entorno.\n' +
      'Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  if (secret.length < 32) {
    throw new Error(
      `[auth-session] SESSION_SECRET es demasiado corto (${secret.length} caracteres). Mínimo: 32.`
    )
  }
  if (secret.toLowerCase().includes('cambiar') || secret.toLowerCase().includes('secret')) {
    throw new Error(
      '[auth-session] SESSION_SECRET contiene el placeholder por defecto. Reemplázalo con un valor aleatorio seguro.'
    )
  }
  return secret
}

// ── HMAC-SHA256: firma y verificación timing-safe ───────────────────────────

/**
 * Serializa el payload en base64url y lo firma con HMAC-SHA256.
 * Formato del token: <base64url(payload)>.<hex(hmac)>
 */
function signPayload(payload: string): string {
  const secret = getSecret()
  const b64 = Buffer.from(payload, 'utf-8').toString('base64url')
  const sig = createHmac('sha256', secret).update(b64).digest('hex')
  return `${b64}.${sig}`
}

/**
 * Verifica la firma del token. Usa comparación timing-safe para
 * prevenir ataques de temporización. Devuelve el payload o null.
 */
function verifyToken(token: string): string | null {
  const dotIndex = token.lastIndexOf('.')
  if (dotIndex === -1) return null

  const b64 = token.slice(0, dotIndex)
  const sig = token.slice(dotIndex + 1)

  try {
    const secret = getSecret()
    const expected = createHmac('sha256', secret).update(b64).digest('hex')

    const sigBuf = Buffer.from(sig, 'hex')
    const expBuf = Buffer.from(expected, 'hex')

    // Los buffers deben tener igual longitud para timingSafeEqual
    if (sigBuf.length !== expBuf.length || sigBuf.length === 0) return null

    if (!timingSafeEqual(sigBuf, expBuf)) return null

    return Buffer.from(b64, 'base64url').toString('utf-8')
  } catch {
    return null
  }
}

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * Crear sesión firmada con HMAC-SHA256 (ilegible e inmanipulable desde cliente)
 */
export async function createSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies()
  const sessionToken = signPayload(JSON.stringify(user))

  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    // secure=true en producción; false en LAN/HTTP local.
    // Cambiar a true si se añade HTTPS (reverse proxy, etc.)
    secure: process.env.NODE_ENV === 'production' || process.env.FORCE_HTTPS === 'true',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
  })
}

/**
 * Obtener y verificar la sesión actual.
 * Fuente 1: cookie HMAC propia (login usuario/contraseña)
 * Fuente 2: auth() de NextAuth v5 (login con Google OAuth)
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()

  // ── 1. Cookie HMAC propia (login manual) ─────────────────────────
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (sessionToken) {
    try {
      const payload = verifyToken(sessionToken)
      if (payload) return JSON.parse(payload) as SessionUser
    } catch {
      // token corrupto, cae al fallback
    }
  }

  // ── 2. Sesión de NextAuth v5 (login con Google) ──────────────────
  // auth() de v5 usa cookies() internamente — funciona en Server Components
  try {
    const session = await googleAuth()
    if (session?.user?.id && session.user.role) {
      return {
        id:       session.user.id,
        username: session.user.email   ?? '',
        role:     session.user.role    as UserRole,
        fullName: session.user.fullName ?? session.user.name ?? '',
      }
    }
  } catch {
    // NextAuth no disponible o sesión inválida
  }

  return null
}

/**
 * Destruir sesión
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE_NAME)
}

/**
 * Verificar si está autenticado
 */
export async function requireAuth(): Promise<SessionUser> {
  const user = await getSession()
  if (!user) {
    throw new Error('No autenticado')
  }
  return user
}

/**
 * Verificar si es ADMIN o SUPERADMIN
 * (ambos pueden gestionar el sistema)
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPERADMIN) {
    throw new Error('Requiere rol ADMIN o SUPERADMIN')
  }
  return user
}

/**
 * Verificar si es SUPERADMIN (nivel más alto — solo Aquiles)
 */
export async function requireSuperAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== UserRole.SUPERADMIN) {
    throw new Error('Requiere rol SUPERADMIN')
  }
  return user
}

/**
 * Verificar si es ADMIN o CAJERO (cualquier empleado activo)
 * SUPERADMIN también pasa este check
 */
export async function requireCajeroOrAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== UserRole.ADMIN && user.role !== UserRole.CAJERO && user.role !== UserRole.SUPERADMIN) {
    throw new Error('Requiere rol CAJERO o ADMIN')
  }
  return user
}
