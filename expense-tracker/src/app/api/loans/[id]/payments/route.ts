import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { loans, loanPayments, people } from '@/db/schema'
import { eq, desc, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// Helper to verify loan belongs to current user
async function verifyLoanOwnership(loanId: string, userId: string) {
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, loanId),
    with: { person: true },
  })

  if (!loan) return null

  // Check if the person belongs to this user
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, loan.personId), eq(people.userId, userId)))
    .limit(1)

  return person ? loan : null
}

// GET /api/loans/:id/payments - List payments for a loan
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  // Verify ownership before listing payments
  const loan = await verifyLoanOwnership(id, userId)
  if (!loan) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  // Verify ownership before creating payment
  const existingLoan = await verifyLoanOwnership(id, userId)
  if (!existingLoan) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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
