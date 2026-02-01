import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people, transactions } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/people/:id - Get person with all transactions and computed balance
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  const person = await db.query.people.findFirst({
    where: and(eq(people.id, id), eq(people.userId, userId)),
    with: {
      transactions: {
        orderBy: [desc(transactions.date), desc(transactions.createdAt)],
      },
    },
  })

  if (!person) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Calculate balance from transactions
  let balance = 0
  for (const tx of person.transactions) {
    if (tx.disregarded) continue

    const amount = parseFloat(tx.amount)
    if (tx.type === 'lent') {
      balance += amount
    } else {
      balance -= amount
    }
  }

  return NextResponse.json({
    ...person,
    balance,
    balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
  })
}

// PUT /api/people/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params
  const body = await request.json()

  const [person] = await db
    .update(people)
    .set({
      name: body.name,
      nickname: body.nickname,
      email: body.email,
      phone: body.phone,
      relationship: body.relationship,
      notes: body.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(people.id, id), eq(people.userId, userId)))
    .returning()

  return NextResponse.json(person)
}

// DELETE /api/people/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  await db.delete(people).where(and(eq(people.id, id), eq(people.userId, userId)))
  return NextResponse.json({ success: true })
}
