import { Suspense } from 'react'
import { LoginView } from '@/ui/pages/login/LoginView'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginView />
    </Suspense>
  )
}
