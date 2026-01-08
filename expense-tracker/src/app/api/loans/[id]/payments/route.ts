import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { loans, loanPayments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/loans/:id/payments - List payments for a loan
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  const payments = await db
    .select()
    .from(loanPayments)
    .where(eq(loanPayments.loanId, id))
    .orderBy(desc(loanPayments.paidAt))

  return NextResponse.json(payments)
}

// POST /api/loans/:id/payments - Record a payment
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  const body = await request.json()

  // Create the payment
  const [payment] = await db
    .insert(loanPayments)
    .values({
      loanId: id,
      amount: body.amount.toString(),
      paidAt: new Date(body.paidAt),
      method: body.method,
      notes: body.notes,
    })
    .returning()

  // Check if loan is now fully paid
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, id),
    with: { payments: true },
  })

  if (loan) {
    const totalPaid = loan.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )

    if (totalPaid >= parseFloat(loan.amount)) {
      await db
        .update(loans)
        .set({ isSettled: true, updatedAt: new Date() })
        .where(eq(loans.id, id))
    }
  }

  return NextResponse.json(payment, { status: 201 })
}
