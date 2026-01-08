import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { loans, loanPayments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/loans/:id
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, id),
    with: {
      person: true,
      payments: {
        orderBy: [desc(loanPayments.paidAt)],
      },
    },
  })

  if (!loan) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const totalPaid = loan.payments.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0
  )

  return NextResponse.json({
    ...loan,
    totalPaid,
    remaining: parseFloat(loan.amount) - totalPaid,
  })
}

// PUT /api/loans/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  const body = await request.json()

  const [loan] = await db
    .update(loans)
    .set({
      direction: body.direction,
      amount: body.amount?.toString(),
      currency: body.currency,
      reason: body.reason,
      transactionDate: body.transactionDate ? new Date(body.transactionDate) : undefined,
      expectedSettlement: body.expectedSettlement
        ? new Date(body.expectedSettlement)
        : null,
      isSettled: body.isSettled,
      notes: body.notes,
      updatedAt: new Date(),
    })
    .where(eq(loans.id, id))
    .returning()

  return NextResponse.json(loan)
}

// DELETE /api/loans/:id
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  await db.delete(loans).where(eq(loans.id, id))
  return NextResponse.json({ success: true })
}
