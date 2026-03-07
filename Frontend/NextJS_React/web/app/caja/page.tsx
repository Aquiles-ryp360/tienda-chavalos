import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth-session'
import { CajaView } from '@/ui/pages/caja/CajaView'
import { getInitialCajaProducts } from '@/lib/server-data'

export default async function CajaPage() {
  let user
  try {
    user = await requireAuth()
  } catch {
    redirect('/login')
  }

  const { products } = await getInitialCajaProducts()

  return <CajaView user={user} initialProducts={products} />
}
