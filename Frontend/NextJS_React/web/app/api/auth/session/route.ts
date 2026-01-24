import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth-session'

export async function GET() {
  try {
    const user = await getSession()
    
    if (!user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      )
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Error obteniendo sesión:', error)
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
