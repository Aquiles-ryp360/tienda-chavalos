import type { DecimalJsLike } from '@prisma/client/runtime/library'

interface DecimalToNumberLike {
  toNumber(): number
}

export type NumericLike =
  | number
  | string
  | DecimalJsLike
  | DecimalToNumberLike
  | null
  | undefined

function hasToNumber(value: NumericLike): value is DecimalToNumberLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toNumber' in value &&
    typeof value.toNumber === 'function'
  )
}

function isDecimalJsLike(value: NumericLike): value is DecimalJsLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    'd' in value &&
    'e' in value &&
    's' in value &&
    'toFixed' in value &&
    typeof value.toFixed === 'function'
  )
}

/**
 * Formatea un valor numérico como moneda Peruana (Soles)
 * @param value - Número, string o Decimal a formatear
 * @returns String formateado como "S/ 0.00"
 */
export function formatMoneyPEN(value: NumericLike): string {
  try {
    const numValue = decimalToNumber(value)

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
export function decimalToNumber(value: NumericLike): number {
  if (value === null || value === undefined) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return parseFloat(value)
  if (hasToNumber(value)) {
    return value.toNumber()
  }
  if (isDecimalJsLike(value)) {
    return Number(value.toFixed())
  }
  return 0
}

/**
 * Redondea un número a N decimales
 */
export function roundToDecimals(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
