'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useState } from 'react'
import styles from './tienda.module.css'

export function SearchInput() {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(searchParams.get('q') ?? '')

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value
      setValue(v)

      const params = new URLSearchParams(searchParams.toString())
      if (v.trim()) {
        params.set('q', v.trim())
      } else {
        params.delete('q')
      }
      // Debounce con replace para no saturar el historial
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  return (
    <input
      type="search"
      className={styles.searchInput}
      placeholder="Buscar por nombre, SKU o descripción…"
      value={value}
      onChange={handleChange}
      autoFocus
    />
  )
}
