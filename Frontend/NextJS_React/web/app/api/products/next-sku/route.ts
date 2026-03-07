import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-session'
import { getErrorMessage } from '@/lib/api-utils'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/products/next-sku?prefix=XXX
 * Returns the next SKU number for a given prefix
 * Example: prefix=CAB-ELE returns { nextSku: "CAB-ELE-003" }
 */
export async function GET(request: NextRequest) {
  try {
    await requireAuth()

    const { searchParams } = new URL(request.url)
    const prefix = searchParams.get('prefix')

    if (!prefix || prefix.trim().length === 0) {
      return NextResponse.json(
        { error: 'prefix parameter is required' },
        { status: 400 }
      )
    }

    // Find all products with SKU starting with prefix
    const products = await prisma.product.findMany({
      where: {
        sku: {
          startsWith: prefix,
          mode: 'insensitive',
        },
        isActive: true,
      },
      select: {
        sku: true,
      },
      orderBy: {
        sku: 'desc',
      },
      take: 1,
    })

    let nextNumber = 1

    if (products.length > 0) {
      const lastSku = products[0].sku
      // Extract the number part from the last SKU
      // Format: "PREFIX-###" or "PREFIX"
      const numberMatch = lastSku.match(/(\d+)$/)
      if (numberMatch) {
        nextNumber = parseInt(numberMatch[1], 10) + 1
      }
    }

    // Format the next SKU with zero-padded number
    const nextSku = `${prefix}-${String(nextNumber).padStart(3, '0')}`

    return NextResponse.json({ nextSku })
  } catch (error: unknown) {
    if (getErrorMessage(error) === 'No autenticado') {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    console.error('Error in GET /api/products/next-sku:', error)

    return NextResponse.json(
      { error: 'Error al obtener siguiente SKU' },
      { status: 500 }
    )
  }
}
