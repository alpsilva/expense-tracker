import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions, people } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string; txId: string }>
}

// PATCH /api/people/:id/transactions/:txId - Update transaction
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: personId, txId } = await context.params
  const body = await request.json()

  // Verify person belongs to user
  const person = await db.query.people.findFirst({
    where: and(eq(people.id, personId), eq(people.userId, userId)),
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  // Update transaction
  const [transaction] = await db
    .update(transactions)
    .set({
      disregarded: body.disregarded,
    })
    .where(and(eq(transactions.id, txId), eq(transactions.personId, personId)))
    .returning()

  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  return NextResponse.json(transaction)
}
