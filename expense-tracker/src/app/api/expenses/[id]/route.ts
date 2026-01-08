import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/expenses/:id
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
    .limit(1)

  if (!expense) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(expense)
}

// PUT /api/expenses/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params
  const body = await request.json()

  const [expense] = await db
    .update(recurringExpenses)
    .set({
      name: body.name,
      description: body.description,
      amount: body.amount?.toString(),
      currency: body.currency,
      category: body.category,
      recurrence: body.recurrence,
      paymentMethod: body.paymentMethod,
      dueDay: body.dueDay,
      dueMonth: body.dueMonth,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes,
      url: body.url,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
    .returning()

  return NextResponse.json(expense)
}

// DELETE /api/expenses/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  await db
    .delete(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))

  return NextResponse.json({ success: true })
}
