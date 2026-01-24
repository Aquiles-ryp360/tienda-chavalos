/**
 * Remove accents and special characters from text
 */
export function removeAccents(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\w\s]/g, '') // Remove special characters except spaces
}

/**
 * Generate SKU prefix from product name
 * Rules:
 * - Take first 3 letters of first 1-2 words
 * - Uppercase
 * - 1 word: "AAA"
 * - 2+ words: "AAA-BBB"
 *
 * Examples:
 * "Cable eléctrico" → "CAB-ELE"
 * "Martillo" → "MAR"
 * "Clavo 2 pulgadas" → "CLA-PUL"
 */
export function slugToSkuPrefix(name: string): string {
  if (!name || name.trim().length === 0) {
    return ''
  }

  // Remove accents and normalize
  const normalized = removeAccents(name.trim())

  // Split by spaces and filter empty strings
  const words = normalized
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return ''
  }

  if (words.length === 1) {
    // Single word: take first 3 letters
    return words[0].substring(0, 3).toUpperCase()
  }

  // Multiple words: take first 3 letters of first 2 words
  const firstWord = words[0].substring(0, 3).toUpperCase()
  const secondWord = words[1].substring(0, 3).toUpperCase()

  return `${firstWord}-${secondWord}`
}

/**
 * Fetch next SKU number from API
 */
export async function getNextSku(prefix: string): Promise<string | null> {
  if (!prefix) return null

  try {
    const response = await fetch(`/api/products/next-sku?prefix=${encodeURIComponent(prefix)}`)
    if (!response.ok) {
      console.warn(`Failed to fetch next SKU for prefix ${prefix}`, response.status)
      return null
    }

    const data = await response.json() as { nextSku: string }
    return data.nextSku
  } catch (error) {
    console.error('Error fetching next SKU:', error)
    return null
  }
}

/**
 * Generate full SKU (prefix + number)
 */
export async function generateFullSku(productName: string): Promise<string> {
  const prefix = slugToSkuPrefix(productName)
  if (!prefix) return ''

  const nextSku = await getNextSku(prefix)
  return nextSku || `${prefix}-001`
}
