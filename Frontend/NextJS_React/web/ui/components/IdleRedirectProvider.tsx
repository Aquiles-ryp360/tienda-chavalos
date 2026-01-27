'use client'

import { ReactNode } from 'react'
import { useIdleRedirect } from '@/ui/hooks/useIdleRedirect'

interface IdleRedirectProviderProps {
  children: ReactNode
  idleMs?: number
  route?: string
}

const DEFAULT_IDLE_MS = 60_000
const DEFAULT_ROUTE = '/pagos'

/**
 * Envuelve la app y dispara una redirección tras inactividad.
 * Reinicia el contador ante movimiento/teclado/touch/scroll.
 */
export function IdleRedirectProvider({
  children,
  idleMs = DEFAULT_IDLE_MS,
  route = DEFAULT_ROUTE,
}: IdleRedirectProviderProps) {
  useIdleRedirect({ idleMs, route })
  return <>{children}</>
}
