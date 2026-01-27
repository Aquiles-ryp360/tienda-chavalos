'use client'

import { useEffect, useState } from 'react'
import styles from './share-whatsapp-modal.module.css'

interface ShareWhatsAppModalProps {
  open: boolean
  onClose: () => void
  onShare: (normalizedDigits: string) => void
}

const normalizePhone = (value: string): string => {
  const digits = value.replace(/\D+/g, '')
  if (digits.length === 9) return `51${digits}` // Asumir Perú si da 9 dígitos
  return digits
}

const isValid = (digits: string): boolean =>
  digits.length >= 9 && digits.length <= 15

export function ShareWhatsAppModal({ open, onClose, onShare }: ShareWhatsAppModalProps) {
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setPhone('')
      setError('')
    }
  }, [open])

  if (!open) return null

  const handleSubmit = () => {
    const normalized = normalizePhone(phone)
    if (!normalized || !isValid(normalized)) {
      setError('Ingresa un número válido (9 a 15 dígitos). Ej: +51 9xx xxx xxx')
      return
    }
    setError('')
    onShare(normalized)
    onClose()
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <h2 className={styles.title}>Compartir por WhatsApp</h2>
        <p className={styles.description}>
          Escribe el número con código de país (ej: +51 9xx xxx xxx). No se guardará.
        </p>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="whatsapp-number">
            Número de WhatsApp
          </label>
          <input
            id="whatsapp-number"
            className={styles.input}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+51 999 888 777"
            autoFocus
          />
          {error && <span className={styles.error}>{error}</span>}
        </div>

        <div className={styles.actions}>
          <button className={styles.btnSecondary} onClick={onClose}>
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={handleSubmit}>
            Compartir
          </button>
        </div>
      </div>
    </div>
  )
}
