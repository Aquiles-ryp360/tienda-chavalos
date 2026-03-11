/**
 * PATCH /api/admin/usuarios/[id] — actualiza googleEmail, rol o estado de un usuario
 * DELETE /api/admin/usuarios/[id] — quita el googleEmail (revoca acceso Google)
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth-session'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const UpdateSchema = z.object({
  googleEmail: z.string().email().nullable().optional(),
  role:        z.enum(['ADMIN', 'CAJERO']).optional(),
  isActive:    z.boolean().optional(),
  fullName:    z.string().min(2).max(80).optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const body   = await req.json().catch(() => null)
  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', issues: parsed.error.issues }, { status: 400 })
  }

  const data = parsed.data

  // Si se está asignando un googleEmail, verificar que no esté ya en uso por otro usuario
  if (data.googleEmail) {
    const conflict = await prisma.user.findFirst({
      where: { googleEmail: data.googleEmail, NOT: { id } },
    })
    if (conflict) {
      return NextResponse.json({ error: 'Ese correo ya está asignado a otro usuario' }, { status: 409 })
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, username: true, fullName: true, role: true, googleEmail: true, isActive: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  // Solo quita el googleEmail — no elimina el usuario del sistema
  const updated = await prisma.user.update({
    where: { id },
    data: { googleEmail: null },
    select: { id: true, username: true, fullName: true, role: true, googleEmail: true, isActive: true },
  })

  return NextResponse.json(updated)
}
