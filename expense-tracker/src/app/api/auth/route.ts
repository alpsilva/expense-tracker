import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'

// POST /api/auth - Login or register
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { username, pin } = body

  // Validate input
  if (!username || !pin) {
    return NextResponse.json(
      { error: 'Username e PIN são obrigatórios' },
      { status: 400 }
    )
  }

  // Validate PIN format (max 4 digits)
  if (!/^\d{1,4}$/.test(pin)) {
    return NextResponse.json(
      { error: 'PIN deve ter no máximo 4 números' },
      { status: 400 }
    )
  }

  // Check if user exists
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.username, username.toLowerCase()))
    .limit(1)

  if (existingUser) {
    // Validate PIN
    if (existingUser.pin !== pin) {
      return NextResponse.json(
        { error: 'PIN incorreto' },
        { status: 401 }
      )
    }

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set('userId', existingUser.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })

    return NextResponse.json({
      user: {
        id: existingUser.id,
        username: existingUser.username,
      },
      message: 'Login realizado com sucesso',
    })
  }

  // Create new user
  const [newUser] = await db
    .insert(users)
    .values({
      username: username.toLowerCase(),
      pin,
    })
    .returning()

  // Set session cookie
  const cookieStore = await cookies()
  cookieStore.set('userId', newUser.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return NextResponse.json({
    user: {
      id: newUser.id,
      username: newUser.username,
    },
    message: 'Conta criada com sucesso',
    isNewUser: true,
  }, { status: 201 })
}

// GET /api/auth - Check current session
export async function GET() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  if (!userId) {
    return NextResponse.json({ user: null })
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return NextResponse.json({ user: null })
  }

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
    },
  })
}

// DELETE /api/auth - Logout
export async function DELETE() {
  const cookieStore = await cookies()
  cookieStore.delete('userId')

  return NextResponse.json({ success: true })
}
