import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'
import { ToastProvider } from '@/ui/components/Toast/ToastContext'
import { ToastContainer } from '@/ui/components/Toast/ToastContainer'
import { IdleRedirectProvider } from '@/ui/components/IdleRedirectProvider'
import { Providers } from '@/app/Providers'

export const metadata: Metadata = {
  title: 'Ferretería Chavalos',
  description: 'Sistema de gestión para Ferretería Chavalos',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <ToastProvider>
            <IdleRedirectProvider>
              {children}
              <ToastContainer />
            </IdleRedirectProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
