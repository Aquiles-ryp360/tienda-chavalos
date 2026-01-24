import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-session'
import { ProductosView } from '@/ui/pages/productos/ProductosView'

export default async function ProductosPage() {
  let user
  try {
    user = await requireAdmin()
  } catch {
    redirect('/dashboard')
  }

  return <ProductosView user={user} />
}
