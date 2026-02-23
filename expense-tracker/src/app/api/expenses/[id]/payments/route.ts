import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses, paymentRecords } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST /api/expenses/:id/payments — Mark expense as paid for a month
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: expenseId } = await context.params
  const body = await request.json()

  // Validate year
  const year = Number(body.year)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: 'Invalid year.' },
      { status: 400 }
    )
  }

  // Validate month
  const month = Number(body.month)
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid month. Must be 1-12.' },
      { status: 400 }
    )
  }

  // Verify expense belongs to user
  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)))
    .limit(1)

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  // Check if already paid (idempotent)
  const existing = await db.query.paymentRecords.findFirst({
    where: and(
      eq(paymentRecords.expenseId, expenseId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.month, month),
    ),
  })

  if (existing) {
    return NextResponse.json(existing, { status: 200 })
  }

  // Create payment record
  const [record] = await db
    .insert(paymentRecords)
    .values({
      expenseId,
      year,
      month,
      paidAt: new Date(),
    })
    .returning()

  return NextResponse.json(record, { status: 201 })
}

// DELETE /api/expenses/:id/payments — Unmark expense payment for a month
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: expenseId } = await context.params
  const body = await request.json()

  // Validate year
  const year = Number(body.year)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: 'Invalid year.' },
      { status: 400 }
    )
  }

  // Validate month
  const month = Number(body.month)
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid month. Must be 1-12.' },
      { status: 400 }
    )
  }

  // Verify expense belongs to user
  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)))
    .limit(1)

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  // Delete the payment record
  await db
    .delete(paymentRecords)
    .where(and(
      eq(paymentRecords.expenseId, expenseId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.month, month),
    ))

  return NextResponse.json({ success: true })
}
