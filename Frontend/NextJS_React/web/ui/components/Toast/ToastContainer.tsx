'use client'

import { useToast } from './ToastContext'
import styles from './Toast.module.css'

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className={styles.toastContainer}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`${styles.toast} ${styles[toast.type]}`}
          role="alert"
          aria-live="polite"
        >
          <div className={styles.toastIcon}>
            {toast.type === 'success' && '✓'}
            {toast.type === 'error' && '✕'}
            {toast.type === 'warning' && '⚠'}
            {toast.type === 'info' && 'ℹ'}
          </div>
          <div className={styles.toastContent}>
            <div className={styles.toastTitle}>{toast.title}</div>
            {toast.message && (
              <div className={styles.toastMessage}>{toast.message}</div>
            )}
          </div>
          <button
            className={styles.toastClose}
            onClick={() => removeToast(toast.id)}
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
