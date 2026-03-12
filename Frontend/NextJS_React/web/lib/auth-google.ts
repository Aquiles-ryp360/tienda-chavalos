/**
 * lib/auth-google.ts — Configuración de Auth.js (NextAuth v5) con Google OAuth 2.0
 *
 * Flujo:
 *   1. Usuario hace click en "Iniciar sesión con Google"
 *   2. Google redirige a /api/auth/callback/google con el perfil
 *   3. signIn callback verifica que el email existe en la tabla `users` (campo googleEmail)
 *   4. En el primer login, vincula el email al usuario si ya existe por username
 *   5. jwt callback inyecta id/role/fullName en el token
 *   6. session callback expone esos campos al cliente
 *
 * Prerequisito: correr migración de Prisma para agregar googleEmail:
 *   npx prisma migrate dev --name add-google-email
 *
 * Variables de entorno requeridas:
 *   GOOGLE_CLIENT_ID       — console.cloud.google.com → OAuth 2.0 Client IDs
 *   GOOGLE_CLIENT_SECRET   — idem
 *   AUTH_SECRET            — node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *   AUTH_URL               — URL pública de la app (ej: http://192.168.1.x:3000)
 */

import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import type { UserRole } from '@prisma/client'

// Extender tipos de next-auth v5 para incluir campos personalizados del usuario
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string | null
      role: UserRole
      fullName: string
    }
  }
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],

  // JWT: no requiere tabla de sesiones en BD, funciona en modo standalone LAN
  session: { strategy: 'jwt' },

  secret: process.env.AUTH_SECRET,

  // Necesario para funcionar en localhost y detrás de proxies/Vercel
  trustHost: true,

  callbacks: {
    /**
     * Ejecutado ANTES de crear la sesión.
     * Retorna false para rechazar el login si el email no está pre-autorizado.
     */
    async signIn({ profile }) {
      if (!profile?.email) return false

      const email = profile.email as string

      // Buscar usuario por googleEmail (vinculación previa)
      let linkedUser = await prisma.user.findUnique({
        where: { googleEmail: email },
        select: { id: true, isActive: true, role: true },
      })

      // Primera vez: vincular automáticamente si el username = email de Google
      // El admin puede configurar el username de un empleado como su Gmail
      if (!linkedUser) {
        const byUsername = await prisma.user.findUnique({
          where: { username: email },
          select: { id: true, isActive: true, role: true },
        })

        if (byUsername) {
          // Vincular email de Google a este usuario
          await prisma.user.update({
            where: { id: byUsername.id },
            data: { googleEmail: email },
          })
          linkedUser = byUsername
        }
      }

      if (!linkedUser) {
        // Email no registrado → tienda pública
        console.warn(`[auth-google] Email no autorizado: ${email}`)
        return '/tienda?msg=no-autorizado'
      }

      if (!linkedUser.isActive) {
        // Usuario desactivado → tienda pública
        console.warn(`[auth-google] Usuario inactivo: ${email}`)
        return '/tienda?msg=inactivo'
      }

      // SUPERADMIN, ADMIN, CAJERO → permitir, Auth.js redirige al callbackUrl (/dashboard)
      return true
    },

    /**
     * Inyecta datos del usuario de Prisma en el JWT.
     * Se ejecuta en cada login y en cada renovación de token.
     */
    async jwt({ token, profile }) {
      // `profile` solo está disponible en el login inicial
      if (profile?.email) {
        const user = await prisma.user.findUnique({
          where: { googleEmail: profile.email as string },
          select: { id: true, username: true, role: true, fullName: true },
        })

        if (user) {
          // Almacenar en el token usando nombres con prefijo para evitar conflictos
          ;(token as Record<string, unknown>)['userId'] = user.id
          ;(token as Record<string, unknown>)['userRole'] = user.role
          ;(token as Record<string, unknown>)['userFullName'] = user.fullName
        }
      }
      return token
    },

    /**
     * Expone los campos del JWT en el objeto `session` del cliente.
     */
    async session({ session, token }) {
      const t = token as Record<string, unknown>
      if (t['userId']) {
        session.user.id = t['userId'] as string
        session.user.role = t['userRole'] as UserRole
        session.user.fullName = (t['userFullName'] as string) ?? session.user.name ?? ''
      }
      return session
    },
  },

  pages: {
    signIn: '/login',   // Redirige a tu página de login existente
    error: '/login',    // Auth.js agrega ?error=ErrorCode automáticamente
  },
})
