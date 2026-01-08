import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses } from '@/db/schema'
import { eq } from 'drizzle-orm'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/expenses/:id
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.id, id))
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
    .where(eq(recurringExpenses.id, id))
    .returning()

  return NextResponse.json(expense)
}

// DELETE /api/expenses/:id
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  await db
    .delete(recurringExpenses)
    .where(eq(recurringExpenses.id, id))

  return NextResponse.json({ success: true })
}
