import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { checkRateLimit } from '@/lib/rate-limit'

const ForumPostSchema = z.object({
  authorName: z.string().trim().min(2, 'Apodo muy corto').max(30, 'Apodo muy largo'),
  content:    z.string().trim().min(5, 'Mensaje muy corto').max(500, 'Máximo 500 caracteres'),
})

/**
 * GET /api/public/productos/[id]/foro
 * Devuelve los posts del foro de un producto (sin autenticación).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const posts = await prisma.forumPost.findMany({
    where:   { productId: id, isHidden: false },
    select:  { id: true, authorName: true, content: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take:    100,
  })

  return NextResponse.json({ posts })
}

/**
 * POST /api/public/productos/[id]/foro
 * Publica un comentario anónimo (solo apodo + mensaje). Sin login.
 * Rate limit: 5 posts por IP cada 15 minutos.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const ip    = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'anon'

  // Rate limit específico para el foro
  if (!checkRateLimit(`foro:${ip}`, 5)) {
    return NextResponse.json(
      { error: 'Demasiados mensajes. Espera unos minutos.' },
      { status: 429 },
    )
  }

  const body   = await req.json().catch(() => null)
  const parsed = ForumPostSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', issues: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  // Verificar que el producto existe y está activo
  const product = await prisma.product.findUnique({
    where:  { id, isActive: true },
    select: { id: true },
  })

  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 })
  }

  const post = await prisma.forumPost.create({
    data: {
      productId:  id,
      authorName: parsed.data.authorName,
      content:    parsed.data.content,
    },
    select: { id: true, authorName: true, content: true, createdAt: true },
  })

  return NextResponse.json({ post }, { status: 201 })
}
