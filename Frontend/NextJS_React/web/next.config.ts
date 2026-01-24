/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    externalDir: true,
  },
  // Permitir acceso desde cualquier host en desarrollo (LAN)
  // Para soportar acceso desde móvil y otras IPs locales
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: ['localhost', '127.0.0.1', '*.local'],
  }),
}

export default nextConfig
