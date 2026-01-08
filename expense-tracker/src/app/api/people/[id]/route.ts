import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people, loanPayments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/people/:id - Get person with all loans and computed balance
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  const person = await db.query.people.findFirst({
    where: eq(people.id, id),
    with: {
      loans: {
        with: {
          payments: {
            orderBy: [desc(loanPayments.paidAt)],
          },
        },
      },
    },
  })

  if (!person) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Calculate balance and enrich loans
  let balance = 0
  const enrichedLoans = person.loans.map((loan) => {
    const loanAmount = parseFloat(loan.amount)
    const totalPaid = loan.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )
    const remaining = loanAmount - totalPaid

    if (loan.direction === 'lent') {
      balance += remaining
    } else {
      balance -= remaining
    }

    return {
      ...loan,
      totalPaid,
      remaining,
    }
  })

  return NextResponse.json({
    ...person,
    loans: enrichedLoans,
    balance,
    balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
  })
}

// PUT /api/people/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params
  const body = await request.json()

  const [person] = await db
    .update(people)
    .set({
      name: body.name,
      nickname: body.nickname,
      email: body.email,
      phone: body.phone,
      relationship: body.relationship,
      notes: body.notes,
      updatedAt: new Date(),
    })
    .where(eq(people.id, id))
    .returning()

  return NextResponse.json(person)
}

// DELETE /api/people/:id
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params

  await db.delete(people).where(eq(people.id, id))
  return NextResponse.json({ success: true })
}
