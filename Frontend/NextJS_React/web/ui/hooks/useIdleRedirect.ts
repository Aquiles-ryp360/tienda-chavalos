'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

interface UseIdleRedirectOptions {
  idleMs?: number
  route: string
  enabled?: boolean
  exposeRemaining?: boolean
  canRedirect?: () => boolean
  onRedirectBlocked?: () => void
}

interface UseIdleRedirectResult {
  remainingMs: number
  isCancelled: boolean
  cancel: () => void
  resume: () => void
  goNow: () => void
}

export const DEFAULT_IDLE_MS = 5_000

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
  idleMs = DEFAULT_IDLE_MS,
  route,
  enabled = true,
  exposeRemaining = false,
  canRedirect,
  onRedirectBlocked,
}: UseIdleRedirectOptions): UseIdleRedirectResult {
  const router = useRouter()
  const pathname = usePathname()

  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const hasRedirectedRef = useRef<boolean>(false)
  const lastHandledRef = useRef<number>(0)
  const [remainingMs, setRemainingMs] = useState<number>(idleMs)
  const [isCancelled, setIsCancelled] = useState<boolean>(false)

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  const canProceed = useCallback(() => {
    const allowed = canRedirect ? canRedirect() : true
    if (!allowed && onRedirectBlocked) {
      onRedirectBlocked()
    }
    return allowed
  }, [canRedirect, onRedirectBlocked])

  const performRedirect = useCallback(() => {
    if (hasRedirectedRef.current) return
    if (!canProceed()) {
      clearTimers()
      return
    }

    hasRedirectedRef.current = true
    clearTimers()

    if (pathname !== route) {
      router.push(route)
    }
  }, [canProceed, clearTimers, pathname, route, router])

  const cancel = useCallback(() => {
    setIsCancelled(true)
    clearTimers()
  }, [clearTimers])

  const startTimers = useCallback(() => {
    clearTimers()
    if (!enabled || isCancelled) return

    hasRedirectedRef.current = false
    setRemainingMs(idleMs)

    timeoutRef.current = setTimeout(() => {
      performRedirect()
    }, idleMs)

    if (exposeRemaining) {
      intervalRef.current = setInterval(() => {
        setRemainingMs((prev) => {
          const next = Math.max(0, prev - 1000)
          if (next <= 0) {
            performRedirect()
            clearTimers()
            return 0
          }
          return next
        })
      }, 1000)
    }
  }, [clearTimers, enabled, idleMs, isCancelled, exposeRemaining, performRedirect])

  const resume = useCallback(() => {
    setIsCancelled(false)
    startTimers()
  }, [startTimers])

  const goNow = useCallback(() => {
    setIsCancelled(false)
    performRedirect()
  }, [performRedirect])

  useEffect(() => {
    const handler = () => {
      const now = Date.now()
      if (now - lastHandledRef.current < 200) return // throttle simple
      lastHandledRef.current = now
      if (isCancelled) return
      startTimers()
    }

    startTimers()
    EVENTS.forEach((event) => window.addEventListener(event, handler, { passive: true }))

    return () => {
      EVENTS.forEach((event) => window.removeEventListener(event, handler))
      clearTimers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimers, enabled, idleMs, isCancelled, route, startTimers])

  if (exposeRemaining) {
    return { remainingMs, cancel, resume, goNow, isCancelled }
  }

  return { remainingMs, cancel, resume, goNow, isCancelled }
}
