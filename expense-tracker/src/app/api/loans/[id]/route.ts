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

// GET /api/loans/:id
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

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

  // Verify the person belongs to this user
  const [person] = await db
    .select()
    .from(people)
    .where(and(eq(people.id, loan.personId), eq(people.userId, userId)))
    .limit(1)

  if (!person) {
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
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  // Verify ownership before updating
  const existingLoan = await verifyLoanOwnership(id, userId)
  if (!existingLoan) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

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
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  // Verify ownership before deleting
  const existingLoan = await verifyLoanOwnership(id, userId)
  if (!existingLoan) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await db.delete(loans).where(eq(loans.id, id))
  return NextResponse.json({ success: true })
}
