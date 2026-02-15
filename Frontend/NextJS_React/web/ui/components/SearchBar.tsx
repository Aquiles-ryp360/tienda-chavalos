'use client'

import { useRef, useEffect } from 'react'
import styles from './searchBar.module.css'

interface SearchBarProps {
  /** Valor actual del input (controlado) */
  value: string
  /** Callback al cambiar el texto */
  onChange: (value: string) => void
  /** Placeholder del input */
  placeholder?: string
  /** Mostrar indicador de carga (spinner inline) */
  loading?: boolean
  /** Los resultados están "stale" (datos previos visibles, cargando nuevos) */
  stale?: boolean
  /** Auto-focus al montar */
  autoFocus?: boolean
  /** Aria-label */
  ariaLabel?: string
  /** Clase CSS adicional para el wrapper */
  className?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder = 'Buscar por SKU o nombre...',
  loading = false,
  stale = false,
  autoFocus = false,
  ariaLabel = 'Buscar productos',
  className,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
    }
  }, [autoFocus])

  return (
    <div className={`${styles.searchWrapper} ${className ?? ''}`}>
      <span className={styles.searchIcon} aria-hidden="true">
        🔍
      </span>
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={styles.searchInput}
        aria-label={ariaLabel}
      />
      {loading && (
        <span className={styles.spinnerIcon} aria-label="Buscando...">
          <span className={styles.spinner} />
        </span>
      )}
      {value && !loading && (
        <button
          type="button"
          className={styles.clearBtn}
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
        >
          ✕
        </button>
      )}
    </div>
  )
}
