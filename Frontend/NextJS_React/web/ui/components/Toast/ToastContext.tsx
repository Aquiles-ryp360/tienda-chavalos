'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
  notify: (options: { type: ToastType; title: string; message?: string; duration?: number }) => void
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9)
      const newToast: Toast = { ...toast, id }

      setToasts((prev) => [...prev, newToast])

      // Auto-remove based on type
      const duration =
        toast.duration ||
        (toast.type === 'error' ? 6000 : toast.type === 'warning' ? 5000 : 3000)

      setTimeout(() => {
        removeToast(id)
      }, duration)
    },
    [removeToast]
  )

  const notify = useCallback(
    (options: { type: ToastType; title: string; message?: string; duration?: number }) => {
      addToast(options)
    },
    [addToast]
  )

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, notify }}>
      {children}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
