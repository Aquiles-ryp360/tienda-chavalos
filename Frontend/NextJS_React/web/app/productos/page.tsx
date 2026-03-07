import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth-session'
import { ProductosView } from '@/ui/pages/productos/ProductosView'
import { getInitialAdminProducts } from '@/lib/server-data'

export default async function ProductosPage() {
  let user
  try {
    user = await requireAdmin()
  } catch {
    redirect('/dashboard')
  }

  const { products, total } = await getInitialAdminProducts()

  return <ProductosView user={user} initialProducts={products} initialTotal={total} />
}
