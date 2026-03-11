import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // output: 'standalone' — SOLO para Docker/LAN. En Vercel se comenta/elimina.
  // Para volver al modo LAN: descomentar esta línea y hacer build manual.
  // output: 'standalone',
  compress: true,            // Gzip/Brotli automático en el servidor standalone
  poweredByHeader: false,    // Elimina cabecera "X-Powered-By" (ahorra bytes)

  // ── Optimización de imágenes ──────────────────────────────
  images: {
    formats: ['image/webp'],           // WebP por defecto (más liviano que JPEG)
    minimumCacheTTL: 31536000,         // 1 año de cache para imágenes optimizadas
    deviceSizes: [640, 750, 828, 1080], // Solo tamaños útiles para LAN/móvil
    imageSizes: [16, 32, 48, 64, 96, 128, 256], // Thumbnails
  },

  // Permitir acceso desde cualquier host (LAN: IPs, hostnames, móviles)
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.local'],

  // ── Cabeceras de seguridad y caché ──────────────────────────────────────
  async headers() {
    return [
      // —— Security Headers (aplica a todas las rutas) —————————————————
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // 'unsafe-inline' requerido por Next.js App Router (estilos inline en RSC).
              // Para producción con HTTPS agregar 'nonce-{nonce}' y eliminar unsafe-inline.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              "connect-src 'self'",
              "media-src 'none'",
              "object-src 'none'",
              "frame-ancestors 'none'",      // Previene clickjacking
              "base-uri 'self'",
              "form-action 'self'",
              'upgrade-insecure-requests',
            ].join('; '),
          },
          // Previene clickjacking (doble protección con frame-ancestors)
          { key: 'X-Frame-Options', value: 'DENY' },
          // Previene MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // No filtrar información del referrer a dominios externos
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Deshabilitar APIs sensibles del navegador innecesarias
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Forzar HTTPS por 1 año cuando se active (habilitar al poner HTTPS)
          // { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },

      {
        // Imágenes estáticas (public/)
        source: '/payments/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Fuentes
        source: '/fonts/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Assets generados por Next.js (JS, CSS con hash)
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Imágenes optimizadas por Next.js
        source: '/_next/image/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Todos los archivos estáticos en public/
        source: '/:all*(svg|jpg|jpeg|png|webp|avif|ico|gif|woff|woff2|ttf|eot|css)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },
}

export default nextConfig
