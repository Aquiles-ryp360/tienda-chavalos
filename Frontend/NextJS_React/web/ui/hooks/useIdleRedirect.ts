'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface UseIdleRedirectOptions {
  idleMs: number
  route: string
  enabled?: boolean
  exposeRemaining?: boolean
}

interface UseIdleRedirectResult {
  remainingMs: number
}

const EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
]

/**
 * Redirige a una ruta tras inactividad del usuario.
 * Reinicia el contador en cualquier interacción básica.
 * Evita fugas de memoria limpiando listeners y timers.
 * Devuelve remainingMs opcionalmente para mostrar un contador visual.
 */
export function useIdleRedirect({
  idleMs,
  route,
  enabled = true,
  exposeRemaining = false,
}: UseIdleRedirectOptions): UseIdleRedirectResult | void {
  const router = useRouter()
  const pathname = usePathname()

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastHandledRef = useRef<number>(0)
  const [remainingMs, setRemainingMs] = useState<number>(idleMs)

  const clearTimers = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const startTimers = () => {
    clearTimers()
    if (!enabled) return

    setRemainingMs(idleMs)

    timeoutRef.current = setTimeout(() => {
      if (pathname !== route) {
        router.push(route)
      }
    }, idleMs)

    if (exposeRemaining) {
      intervalRef.current = setInterval(() => {
        setRemainingMs((prev) => Math.max(0, prev - 1000))
      }, 1000)
    }
  }

  useEffect(() => {
    const handler = () => {
      const now = Date.now()
      if (now - lastHandledRef.current < 200) return // throttle simple
      lastHandledRef.current = now
      startTimers()
    }

    startTimers()
    EVENTS.forEach((event) => window.addEventListener(event, handler, { passive: true }))

    return () => {
      EVENTS.forEach((event) => window.removeEventListener(event, handler))
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idleMs, route, enabled, pathname, router])

  if (exposeRemaining) {
    return { remainingMs }
  }
}
