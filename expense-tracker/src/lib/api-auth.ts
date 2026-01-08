import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function getAuthUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('userId')?.value ?? null
}

export async function requireAuthUserId(): Promise<string> {
  const userId = await getAuthUserId()
  if (!userId) {
    throw new AuthError('Unauthorized')
  }
  return userId
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
}
