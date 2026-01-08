import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { loans, people, loanPayments } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// GET /api/loans - List all loans
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const activeOnly = searchParams.get('active') === 'true'
  const personId = searchParams.get('personId')
  const direction = searchParams.get('direction') as 'lent' | 'borrowed' | null

  const allLoans = await db.query.loans.findMany({
    where: and(
      activeOnly ? eq(loans.isSettled, false) : undefined,
      personId ? eq(loans.personId, personId) : undefined,
      direction ? eq(loans.direction, direction) : undefined
    ),
    with: {
      person: true,
      payments: {
        orderBy: [desc(loanPayments.paidAt)],
      },
    },
    orderBy: [desc(loans.transactionDate)],
  })

  // Enrich with computed fields
  const enrichedLoans = allLoans.map((loan) => {
    const totalPaid = loan.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )
    return {
      ...loan,
      totalPaid,
      remaining: parseFloat(loan.amount) - totalPaid,
    }
  })

  return NextResponse.json(enrichedLoans)
}

// POST /api/loans - Create new loan
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Create person inline if needed
  let personId = body.personId

  if (!personId && body.personName) {
    const [person] = await db
      .insert(people)
      .values({
        name: body.personName,
        nickname: body.personNickname,
        email: body.personEmail,
        phone: body.personPhone,
        relationship: body.personRelationship,
      })
      .returning()
    personId = person.id
  }

  const [loan] = await db
    .insert(loans)
    .values({
      personId,
      direction: body.direction,
      amount: body.amount.toString(),
      currency: body.currency || 'BRL',
      reason: body.reason,
      transactionDate: new Date(body.transactionDate),
      expectedSettlement: body.expectedSettlement
        ? new Date(body.expectedSettlement)
        : null,
      notes: body.notes,
    })
    .returning()

  // Fetch with person
  const enrichedLoan = await db.query.loans.findFirst({
    where: eq(loans.id, loan.id),
    with: { person: true },
  })

  return NextResponse.json(enrichedLoan, { status: 201 })
}
