'use client'

import styles from './centered-alert-modal.module.css'

interface CenteredAlertModalProps {
  open: boolean
  type: 'success' | 'error'
  title: string
  message: string
  onClose: () => void
}

export function CenteredAlertModal({ open, type, title, message, onClose }: CenteredAlertModalProps) {
  if (!open) return null

  return (
    <div className={styles.overlay} role="alertdialog" aria-modal="true">
      <div className={`${styles.modal} ${type === 'success' ? styles.success : styles.error}`}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <button className={styles.button} onClick={onClose}>
          OK
        </button>
      </div>
    </div>
  )
}
