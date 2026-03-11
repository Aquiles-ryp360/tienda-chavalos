/**
 * GET  /api/admin/usuarios — lista todos los usuarios (solo ADMIN)
 * POST /api/admin/usuarios — crea un usuario Google-only (solo ADMIN)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomBytes, createHash } from 'crypto'

const CreateSchema = z.object({
  fullName:    z.string().min(2).max(80),
  googleEmail: z.string().email(),
  role:        z.enum(['ADMIN', 'CAJERO']).default('CAJERO'),
})

export async function GET() {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const users = await prisma.user.findMany({
    select: {
      id:          true,
      username:    true,
      fullName:    true,
      role:        true,
      googleEmail: true,
      isActive:    true,
      createdAt:   true,
    },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(users)
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  const { fullName, googleEmail, role } = parsed.data

  // Verificar que el email no esté ya registrado
  const existing = await prisma.user.findUnique({ where: { googleEmail } })
  if (existing) {
    return NextResponse.json({ error: 'Ese correo de Google ya está asignado' }, { status: 409 })
  }

  // Username = parte local del email (ej: "maria.lopez" de maria.lopez@gmail.com)
  const baseUsername = googleEmail.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase()
  let username = baseUsername
  let suffix = 1
  while (await prisma.user.findUnique({ where: { username } })) {
    username = `${baseUsername}_${suffix++}`
  }

  // Contraseña aleatoria (el usuario solo usará Google para entrar)
  const randomPassword = randomBytes(32).toString('hex')
  const passwordHash   = createHash('sha256').update(randomPassword).digest('hex')

  const user = await prisma.user.create({
    data: { username, fullName, googleEmail, role, passwordHash, isActive: true },
    select: { id: true, username: true, fullName: true, role: true, googleEmail: true, isActive: true },
  })

  return NextResponse.json(user, { status: 201 })
}
