import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-session'
import { AccesoView } from '@/ui/pages/acceso/AccesoView'

export const metadata = { title: 'Gestión de Acceso — Ferretería Chavalos' }

export default async function AccesoPage() {
  let user
  try {
    user = await requireAdmin()
  } catch {
    redirect('/login')
  }
  return <AccesoView user={user} />
}
