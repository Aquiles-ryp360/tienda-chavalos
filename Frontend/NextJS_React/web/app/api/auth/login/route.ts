import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createSession } from '@/lib/auth-session'
import { checkRateLimit, resetRateLimit, getRateLimitRetryAfter } from '@/lib/rate-limit'
import bcrypt from 'bcrypt'

// ── Esquema Zod: previene Prisma Object Injection y strings maliciosos ──────
const LoginSchema = z.object({
  username: z
    .string()
    .min(1, 'Usuario requerido')
    .max(50)
    .regex(/^[a-zA-Z0-9_@.\-]+$/, 'Formato de usuario inválido'),
  password: z
    .string()
    .min(1, 'Contraseña requerida')
    .max(128),
})

export async function POST(request: NextRequest) {
  // ── 1. Rate limiting por IP ──────────────────────────────────────────────
  const headersList = await headers()
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ??
    headersList.get('x-real-ip') ??
    'unknown'

  if (!checkRateLimit(ip)) {
    const retryAfter = getRateLimitRetryAfter(ip)
    return NextResponse.json(
      { error: `Demasiados intentos fallidos. Intenta de nuevo en ${Math.ceil(retryAfter / 60)} minutos.` },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': '5',
          'X-RateLimit-Window': '900',
        },
      }
    )
  }

  try {
    // ── 2. Validación de esquema con Zod ────────────────────────────────────
    const rawBody = await request.json()
    const parsed = LoginSchema.safeParse(rawBody)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos de entrada inválidos' },
        { status: 400 }
      )
    }

    const { username, password } = parsed.data

    // ── 3. Buscar usuario ────────────────────────────────────────────────────
    const user = await prisma.user.findUnique({
      where: { username },
    })

    if (!user || !user.isActive) {
      // No revelar si el usuario existe o no (timing-safe message)
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // ── 4. Verificar password ────────────────────────────────────────────────
    const isValidPassword = await bcrypt.compare(password, user.passwordHash)

    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Credenciales inválidas' },
        { status: 401 }
      )
    }

    // ── 5. Login exitoso: resetear rate limit y crear sesión firmada ─────────
    resetRateLimit(ip)

    await createSession({
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        fullName: user.fullName,
      },
    })
  } catch (error) {
    console.error('Error en login:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
