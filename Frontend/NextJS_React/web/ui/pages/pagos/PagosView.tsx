'use client'

import Image from 'next/image'
import { useMemo, useState } from 'react'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { useIdleRedirect } from '@/ui/hooks/useIdleRedirect'
import { ShareWhatsAppModal } from '@/ui/components/ShareWhatsAppModal'
import { PAYMENT_INFO } from '@/lib/payment-info'
import styles from './pagos.module.css'

const IDLE_MS = 60_000

interface PagosViewProps {
  user: {
    fullName: string
    role: string
  }
}

export function PagosView({ user }: PagosViewProps) {
  const idle = useIdleRedirect({
    idleMs: IDLE_MS,
    route: '/pagos',
    exposeRemaining: true,
  })

  const remainingSeconds = useMemo(() => {
    if (!idle?.remainingMs) return Math.ceil(IDLE_MS / 1000)
    return Math.ceil(idle.remainingMs / 1000)
  }, [idle?.remainingMs])

  const [shareOpen, setShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  const handleCopy = async () => {
    const payload = [
      `Ferretería Chavalos – Datos de pago`,
      `Cuenta BCP (S/): ${PAYMENT_INFO.accountBcp}`,
      `CCI: ${PAYMENT_INFO.cci}`,
      `Titular: ${PAYMENT_INFO.holder}`,
    ].join('\n')
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
        setCopyStatus('copied')
        setTimeout(() => setCopyStatus('idle'), 2000)
      } else {
        setCopyStatus('error')
      }
    } catch {
      setCopyStatus('error')
    }
  }

  const handleShare = (normalizedDigits: string) => {
    const message = [
      'Ferretería Chavalos – Datos de pago',
      `Cuenta BCP (S/): ${PAYMENT_INFO.accountBcp}`,
      `CCI: ${PAYMENT_INFO.cci}`,
      `Titular: ${PAYMENT_INFO.holder}`,
      '(verifica el monto antes de enviar)',
    ].join('\n')

    const url = `https://wa.me/${normalizedDigits}?text=${encodeURIComponent(message)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <>
      <Header user={user} />
      <main className={styles.page}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Pagos / Métodos de pago</div>
            <div className={styles.subtitle}>
              Muestra rápida para clientes — escanea o copia los datos.
            </div>
          </div>
          <div className={styles.idleBanner}>
            Modo reposo: regresando en {remainingSeconds}s
          </div>
        </div>

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>QR Yape</div>
            <div className={styles.qrWrapper}>
              <Image
                src="/payments/yape-qr.jpeg"
                alt="QR Yape Ferretería Chavalos"
                width={260}
                height={260}
                className={styles.qrImage}
                priority
              />
            </div>
            <div className={styles.subtitle}>
              Coloca la imagen real de Yape en <code>/public/payments/yape-qr.jpeg</code> si se actualiza.
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Cuenta BCP (Soles)</div>
            <div className={styles.dataRow}>
              <span className={styles.label}>Número de cuenta</span>
              <span className={styles.value}>{PAYMENT_INFO.accountBcp}</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>CCI</span>
              <span className={styles.value}>{PAYMENT_INFO.cci}</span>
            </div>
            <div className={styles.dataRow} style={{ gap: '12px' }}>
              <button className={styles.primaryBtn} onClick={() => setShareOpen(true)}>
                📤 Compartir por WhatsApp
              </button>
              <button className={styles.secondaryBtn} onClick={handleCopy}>
                📋 Copiar datos
              </button>
              {copyStatus === 'copied' && <span className={styles.copyOk}>Copiado</span>}
              {copyStatus === 'error' && <span className={styles.copyError}>No se pudo copiar</span>}
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Instrucciones</div>
            <div className={styles.dataRow}>
              <span className={styles.label}>1.</span>
              <span className={styles.value}>Escanear QR o copiar cuenta.</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>2.</span>
              <span className={styles.value}>Confirmar monto antes de pagar.</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>3.</span>
              <span className={styles.value}>Guardar voucher para adjuntar.</span>
            </div>
          </div>
        </div>
      </main>
      <BottomNav userRole={user.role} />

      <ShareWhatsAppModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShare={handleShare}
      />
    </>
  )
}
