'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { Header } from '@/ui/components/Header'
import { BottomNav } from '@/ui/components/BottomNav'
import { ShareWhatsAppModal } from '@/ui/components/ShareWhatsAppModal'
import { PAYMENT_INFO, formatWhatsAppPaymentText } from '@/lib/payment-info'
import styles from './pagos.module.css'
import { useToast } from '@/ui/components/Toast/ToastContext'
import { generatePaymentCardPng } from '@/lib/payment-share-image'
import { shareWhatsAppWithImage } from '@/lib/share-whatsapp'

interface PagosViewProps {
  user: {
    fullName: string
    role: string
  }
}

export function PagosView({ user }: PagosViewProps) {
  const [shareOpen, setShareOpen] = useState(false)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [qrOpen, setQrOpen] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const { notify } = useToast()

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setQrOpen(false)
    }
    if (qrOpen) {
      document.addEventListener('keydown', onKeyDown)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = ''
    }
  }, [qrOpen])

  const handleCopy = async () => {
    const payload = formatWhatsAppPaymentText({ context: 'pagos' })
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
    shareWithAsset(normalizedDigits)
  }

  const shareWithAsset = async (normalizedDigits?: string) => {
    try {
      setShareLoading(true)
      const text = formatWhatsAppPaymentText({ context: 'pagos' })
      const imgBlob = await generatePaymentCardPng({})
      const result = await shareWhatsAppWithImage({
        text,
        phone: normalizedDigits || undefined,
        imgBlob,
      })
      if (result === 'fallback') {
        notify({
          type: 'info',
          title: 'Imagen descargada',
          message: 'Se abrió WhatsApp con el mensaje. Adjunta la imagen descargada.',
        })
      }
    } catch (error) {
      console.error('Error al compartir por WhatsApp:', error)
      notify({ type: 'error', title: 'No se pudo compartir', message: 'Intenta nuevamente' })
    } finally {
      setShareLoading(false)
    }
  }

  return (
    <>
      <Header user={user} />
      <main className={styles.page}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Pagos</div>
            <div className={styles.subtitle}>
              Muestra rápida para el cliente: escanea el QR o copia los datos.
            </div>
          </div>
        </div>

        <div className={styles.cards}>
          <div className={styles.card}>
            <div className={styles.cardTitle}>QR Yape</div>
            <div
              className={styles.qrWrapper}
              role="button"
              tabIndex={0}
              onClick={() => setQrOpen(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setQrOpen(true)
                }
              }}
            >
              <Image
                src="/payments/yape-qr.jpeg"
                alt="QR Yape Ferretería Chavalos"
                width={260}
                height={260}
                quality={75}
                sizes="(max-width: 768px) 220px, 260px"
                className={styles.qrImage}
                priority
              />
            </div>
            <div className={styles.qrHint}>Toca para ampliar.</div>
          </div>

          <div className={styles.card}>
            <div className={styles.cardTitle}>Cuenta BCP (S/.)</div>
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
              <span className={styles.value}>Escanea el QR o copia la cuenta.</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>2.</span>
              <span className={styles.value}>Confirma el monto antes de pagar.</span>
            </div>
            <div className={styles.dataRow}>
              <span className={styles.label}>3.</span>
              <span className={styles.value}>Guarda el voucher para adjuntarlo.</span>
            </div>
          </div>
        </div>
      </main>
      <BottomNav userRole={user.role} />

      <ShareWhatsAppModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShare={handleShare}
        allowEmpty
        loading={shareLoading}
      />

      {qrOpen && (
        <div
          className={styles.qrModalOverlay}
          role="dialog"
          aria-modal="true"
          onClick={() => setQrOpen(false)}
        >
          <div
            className={styles.qrModalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={styles.qrCloseBtn}
              aria-label="Cerrar imagen QR"
              onClick={() => setQrOpen(false)}
            >
              ×
            </button>
            <Image
              src="/payments/yape-qr.jpeg"
              alt="QR Yape Ferretería Chavalos ampliado"
              width={700}
              height={700}
              quality={75}
              sizes="(max-width: 768px) 90vw, 700px"
              className={styles.qrModalImage}
              priority
            />
          </div>
        </div>
      )}
    </>
  )
}
