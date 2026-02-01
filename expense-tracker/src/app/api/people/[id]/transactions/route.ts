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

  const [transaction] = await db
    .insert(transactions)
    .values({
      personId,
      type: body.type,
      amount: body.amount.toString(),
      date: new Date(body.date),
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
