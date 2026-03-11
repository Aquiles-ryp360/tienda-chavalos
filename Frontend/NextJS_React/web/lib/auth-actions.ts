'use server'
/**
 * lib/auth-actions.ts — Server Actions para Google OAuth (Auth.js v5)
 *
 * Patrón correcto en v5 + Next.js 15 App Router:
 *   - signIn/signOut se llaman desde Server Actions
 *   - Se usan como action= en <form> o con startTransition
 *   - NO requieren SessionProvider ni client-side next-auth/react
 */
import { signIn, signOut } from '@/lib/auth-google'

export async function signInWithGoogle() {
  await signIn('google', { redirectTo: '/dashboard' })
}

export async function signOutGoogle() {
  await signOut({ redirectTo: '/login' })
}
