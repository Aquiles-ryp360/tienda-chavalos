'use client'

import { sanitizePhoneE164Peru } from './payment-info'

interface ShareParams {
  text: string
  phone?: string
  imgBlob: Blob
  filename?: string
}

export async function shareWhatsAppWithImage({
  text,
  phone,
  imgBlob,
  filename = 'pago-yape-ferreteria-chavalos.png',
}: ShareParams): Promise<'shared' | 'fallback'> {
  const file = new File([imgBlob], filename, { type: 'image/png' })
  const canShareFile =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] }) &&
    typeof navigator.share === 'function'

  if (canShareFile) {
    await navigator.share({
      title: 'Pago - Ferretería Chavalos',
      text,
      files: [file],
    })
    return 'shared'
  }

  // Fallback: abrir wa.me con texto
  const normalizedPhone = phone ? sanitizePhoneE164Peru(phone) : ''
  const url = normalizedPhone
    ? `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`
    : `https://wa.me/?text=${encodeURIComponent(text)}`
  window.open(url, '_blank', 'noopener,noreferrer')

  // Descargar imagen para adjuntar manualmente
  const a = document.createElement('a')
  const objectUrl = URL.createObjectURL(imgBlob)
  a.href = objectUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(objectUrl)

  return 'fallback'
}
