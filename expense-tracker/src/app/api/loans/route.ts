import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { loans, people, loanPayments } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

// GET /api/loans - List all loans
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const searchParams = request.nextUrl.searchParams
  const activeOnly = searchParams.get('active') === 'true'
  const personId = searchParams.get('personId')
  const direction = searchParams.get('direction') as 'lent' | 'borrowed' | null

  // Get all people for this user to filter loans
  const userPeople = await db
    .select({ id: people.id })
    .from(people)
    .where(eq(people.userId, userId))

  const userPeopleIds = userPeople.map((p) => p.id)

  if (userPeopleIds.length === 0) {
    return NextResponse.json([])
  }

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

  // Filter to only loans belonging to this user's people
  const userLoans = allLoans.filter((loan) => userPeopleIds.includes(loan.personId))

  // Enrich with computed fields
  const enrichedLoans = userLoans.map((loan) => {
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
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const body = await request.json()

  // Create person inline if needed
  let personId = body.personId

  if (!personId && body.personName) {
    const [person] = await db
      .insert(people)
      .values({
        userId,
        name: body.personName,
        nickname: body.personNickname,
        email: body.personEmail,
        phone: body.personPhone,
        relationship: body.personRelationship,
      })
      .returning()
    personId = person.id
  } else if (personId) {
    // Verify person belongs to user
    const [person] = await db
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.userId, userId)))
      .limit(1)

    if (!person) {
      return NextResponse.json({ error: 'Pessoa não encontrada' }, { status: 404 })
    }
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
