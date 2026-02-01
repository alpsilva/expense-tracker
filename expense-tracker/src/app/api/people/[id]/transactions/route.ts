import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions, people } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST /api/people/:id/transactions - Create transaction
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: personId } = await context.params
  const body = await request.json()

  // Verify person belongs to user
  const person = await db.query.people.findFirst({
    where: and(eq(people.id, personId), eq(people.userId, userId)),
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  // Validate type
  const allowedTypes = ['lent', 'received'] as const
  if (!allowedTypes.includes(body.type)) {
    return NextResponse.json(
      { error: 'Invalid type. Must be "lent" or "received".' },
      { status: 400 }
    )
  }

  // Validate amount
  const amount = parseFloat(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { error: 'Invalid amount. Must be a positive number.' },
      { status: 400 }
    )
  }

  // Validate date
  const date = new Date(body.date)
  if (isNaN(date.getTime())) {
    return NextResponse.json(
      { error: 'Invalid date.' },
      { status: 400 }
    )
  }

  const [transaction] = await db
    .insert(transactions)
    .values({
      personId,
      type: body.type,
      amount: amount.toString(),
      date,
      description: body.description || null,
    })
    .returning()

  // Update person's updatedAt
  await db
    .update(people)
    .set({ updatedAt: new Date() })
    .where(eq(people.id, personId))

  return NextResponse.json(transaction, { status: 201 })
}
