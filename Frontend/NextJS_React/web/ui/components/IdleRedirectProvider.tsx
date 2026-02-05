'use client'

import { ReactNode } from 'react'

interface IdleRedirectProviderProps {
  children: ReactNode
  /**
   * Mantener la firma por compatibilidad, pero auto-redirect está desactivado por defecto.
   */
  enabled?: boolean
}

/**
 * Wrapper pasivo: no realiza redirecciones automáticas.
 * Se deja la estructura para futuras extensiones sin alterar layout.
 */
export function IdleRedirectProvider({ children }: IdleRedirectProviderProps) {
  return <>{children}</>
}
