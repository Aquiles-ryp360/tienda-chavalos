/**
 * POST /api/superadmin/importar-productos
 * Importación masiva de productos desde CSV.
 * Solo SUPERADMIN puede usarlo.
 *
 * Formato CSV esperado (con encabezado):
 *   sku,nombre,precio,stock,stock_minimo,unidad,descripcion
 *
 * Unidades válidas: UNIDAD, METRO, LITRO, KILO, CAJA, PAQUETE, ROLLO
 * Si el SKU ya existe, el producto se ACTUALIZA. Si no, se CREA.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth-session'
import { prisma } from '@/lib/prisma'
import { ProductUnit } from '@prisma/client'

const VALID_UNITS = Object.values(ProductUnit)

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n')
  if (lines.length < 2) return []

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase()
    .replace(/\s+/g, '_')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
  )

  return lines.slice(1)
    .filter(l => l.trim())
    .map(line => {
      const values = line.split(',').map(v => v.trim())
      return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
    })
}

export async function POST(req: NextRequest) {
  try {
    await requireSuperAdmin()
  } catch {
    return NextResponse.json({ error: 'Solo SUPERADMIN puede importar productos' }, { status: 401 })
  }

  const formData = await req.formData().catch(() => null)
  if (!formData) {
    return NextResponse.json({ error: 'Envía el archivo como multipart/form-data con campo "archivo"' }, { status: 400 })
  }

  const file = formData.get('archivo')
  if (!file || typeof file === 'string') {
    return NextResponse.json({ error: 'Campo "archivo" requerido' }, { status: 400 })
  }

  const text = await (file as File).text()
  const rows = parseCSV(text)

  if (rows.length === 0) {
    return NextResponse.json({ error: 'CSV vacío o formato incorrecto. Revisa que tenga encabezado.' }, { status: 400 })
  }

  const resultados = { creados: 0, actualizados: 0, errores: [] as string[] }

  for (const [i, row] of rows.entries()) {
    const lineNum = i + 2
    const sku     = (row['sku'] ?? '').toUpperCase().trim()
    const name    = (row['nombre'] ?? row['name'] ?? '').trim()
    const precio  = parseFloat(row['precio'] ?? row['price'] ?? '0')
    const stock   = parseFloat(row['stock'] ?? '0')
    const minStock = parseFloat(row['stock_minimo'] ?? row['min_stock'] ?? '5')
    const unitRaw = (row['unidad'] ?? row['unit'] ?? 'UNIDAD').toUpperCase().trim()
    const desc    = (row['descripcion'] ?? row['description'] ?? '').trim() || null

    if (!sku)  { resultados.errores.push(`Línea ${lineNum}: SKU vacío`); continue }
    if (!name) { resultados.errores.push(`Línea ${lineNum}: nombre vacío (SKU: ${sku})`); continue }
    if (isNaN(precio) || precio < 0) { resultados.errores.push(`Línea ${lineNum}: precio inválido (SKU: ${sku})`); continue }

    const unit: ProductUnit = VALID_UNITS.includes(unitRaw as ProductUnit)
      ? unitRaw as ProductUnit
      : 'UNIDAD'

    try {
      const existing = await prisma.product.findUnique({ where: { sku } })

      if (existing) {
        await prisma.product.update({
          where: { sku },
          data: { name, price: precio, stock, minStock, unit, description: desc, isActive: true },
        })
        resultados.actualizados++
      } else {
        await prisma.product.create({
          data: { sku, name, price: precio, stock, minStock, unit, description: desc },
        })
        resultados.creados++
      }
    } catch (e: unknown) {
      resultados.errores.push(`Línea ${lineNum} (SKU: ${sku}): ${e instanceof Error ? e.message : 'Error desconocido'}`)
    }
  }

  return NextResponse.json({
    procesados: rows.length,
    ...resultados,
    ok: resultados.errores.length === 0,
  })
}
