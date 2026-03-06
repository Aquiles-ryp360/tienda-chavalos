'use client'

import { useState, useEffect } from 'react'

/**
 * Hook de debounce genérico.
 * Retrasa la actualización del valor hasta que el usuario deje de escribir
 * por `delay` ms (default: 300ms — sweet spot para LAN).
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
