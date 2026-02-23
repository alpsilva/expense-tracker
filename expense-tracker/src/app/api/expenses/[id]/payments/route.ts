import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/db'
import { recurringExpenses, paymentRecords } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

const paymentSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

function validatePaymentBody(body: unknown) {
  const result = paymentSchema.safeParse(body)
  if (!result.success) {
    return {
      error: NextResponse.json(
        { error: 'Validation failed.', details: result.error.flatten().fieldErrors },
        { status: 400 }
      ),
    }
  }
  return { data: result.data }
}

async function parseJsonBody(request: NextRequest) {
  try {
    return { body: await request.json() as unknown }
  } catch {
    return {
      error: NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }),
    }
  }
}

// POST /api/expenses/:id/payments — Mark expense as paid for a month
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: expenseId } = await context.params

  const json = await parseJsonBody(request)
  if ('error' in json) return json.error

  const validated = validatePaymentBody(json.body)
  if ('error' in validated) return validated.error
  const { year, month } = validated.data

  // Verify expense belongs to user
  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)))
    .limit(1)

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  // Insert with conflict handling for race-safe idempotency
  const inserted = await db
    .insert(paymentRecords)
    .values({
      expenseId,
      year,
      month,
      paidAt: new Date(),
    })
    .onConflictDoNothing()
    .returning()

  if (inserted.length > 0) {
    return NextResponse.json(inserted[0], { status: 201 })
  }

  // Conflict — record already exists, return it
  const existing = await db.query.paymentRecords.findFirst({
    where: and(
      eq(paymentRecords.expenseId, expenseId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.month, month),
    ),
  })

  return NextResponse.json(existing, { status: 200 })
}

// DELETE /api/expenses/:id/payments — Unmark expense payment for a month
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: expenseId } = await context.params

  const json = await parseJsonBody(request)
  if ('error' in json) return json.error

  const validated = validatePaymentBody(json.body)
  if ('error' in validated) return validated.error
  const { year, month } = validated.data

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
