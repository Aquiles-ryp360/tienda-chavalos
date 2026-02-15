import { cookies } from 'next/headers'
import { UserRole } from '@prisma/client'

export interface SessionUser {
  id: string
  username: string
  role: UserRole
  fullName: string
}

const SESSION_COOKIE_NAME = 'ferre_session'
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production'

/**
 * Crear sesión (guarda userId en cookie httpOnly)
 */
export async function createSession(user: SessionUser): Promise<void> {
  const cookieStore = await cookies()
  const sessionData = JSON.stringify(user)
  
  // En producción usar encrypt + sign, aquí simplificado con base64
  const sessionToken = Buffer.from(sessionData).toString('base64')
  
  // secure: false — la app corre en HTTP sobre LAN, no HTTPS.
  // Si en el futuro se agrega HTTPS (ej. reverse proxy), cambiar a:
  //   secure: process.env.FORCE_HTTPS === 'true'
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 horas
    path: '/',
    // No usar domain para que funcione tanto en localhost como en IP local
  })
}

/**
 * Obtener sesión actual
 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!sessionToken) {
    return null
  }

  try {
    const sessionData = Buffer.from(sessionToken, 'base64').toString('utf-8')
    const user = JSON.parse(sessionData) as SessionUser
    return user
  } catch {
    return null
  }
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
 * Verificar si es ADMIN
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.role !== UserRole.ADMIN) {
    throw new Error('Requiere rol ADMIN')
  }
  return user
}
