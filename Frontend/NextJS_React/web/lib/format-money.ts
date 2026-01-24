/**
 * Formatea un valor numérico como moneda Peruana (Soles)
 * @param value - Número, string o Decimal a formatear
 * @returns String formateado como "S/ 0.00"
 */
export function formatMoneyPEN(value: number | string | any): string {
  try {
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value)

    if (isNaN(numValue)) {
      return 'S/ 0.00'
    }

    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numValue)
  } catch (error) {
    console.error('Error formateando moneda:', error)
    return 'S/ 0.00'
  }
}

/**
 * Convierte un Decimal de Prisma a número para uso en cálculos
 */
export function decimalToNumber(value: any): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (value.toNumber && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value)
}

/**
 * Redondea un número a N decimales
 */
export function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
