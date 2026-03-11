/**
 * app/api/auth/[...nextauth]/route.ts
 * Handler catch-all de Auth.js que gestiona todos los endpoints de OAuth:
 *
 *   GET  /api/auth/signin          — Página de signin (redirige a /login)
 *   GET  /api/auth/callback/google — Callback de Google tras autenticación
 *   GET  /api/auth/signout         — Cerrar sesión OAuth
 *   GET  /api/auth/session         — Obtener sesión actual (JSON)
 *   GET  /api/auth/csrf            — Token CSRF
 *   GET  /api/auth/providers       — Lista de providers disponibles
 */

import { handlers } from '@/lib/auth-google'

// Auth.js maneja GET (redirects, callbacks) y POST (signout, csrf)
export const { GET, POST } = handlers
