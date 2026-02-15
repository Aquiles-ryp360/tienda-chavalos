import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',

  // ── Rendimiento agresivo ──────────────────────────────────
  compress: true,            // Gzip/Brotli automático en el servidor standalone
  poweredByHeader: false,    // Elimina cabecera "X-Powered-By" (ahorra bytes)

  experimental: {
    externalDir: true,
  },

  // ── Optimización de imágenes ──────────────────────────────
  images: {
    formats: ['image/webp'],           // WebP por defecto (más liviano que JPEG)
    minimumCacheTTL: 31536000,         // 1 año de cache para imágenes optimizadas
    deviceSizes: [640, 750, 828, 1080], // Solo tamaños útiles para LAN/móvil
    imageSizes: [16, 32, 48, 64, 96, 128, 256], // Thumbnails
  },

  // Permitir acceso desde cualquier host (LAN: IPs, hostnames, móviles)
  allowedDevOrigins: ['localhost', '127.0.0.1', '*.local'],

  // ── Cabeceras de caché agresivas ──────────────────────────
  async headers() {
    return [
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
