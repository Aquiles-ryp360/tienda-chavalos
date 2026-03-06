import { prisma } from '@/lib/prisma'
import bcrypt from '@web/lib/crypto'

export interface LoginInput {
  username: string
  password: string
}

export interface AuthenticatedUser {
  id: string
  username: string
  role: string
  fullName: string
}

/**
 * Verificar credenciales y retornar usuario si son válidas
 */
export async function verifyCredentials(
  input: LoginInput
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({
    where: { username: input.username },
  })

  if (!user || !user.isActive) {
    return null
  }

  const isValid = await bcrypt.compare(input.password, user.passwordHash)

  if (!isValid) {
    return null
  }

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    fullName: user.fullName,
  }
}
