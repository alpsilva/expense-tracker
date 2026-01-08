import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

// GET /api/people - List all people with their balances
export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  // Get all people with their loans and payments
  const allPeople = await db.query.people.findMany({
    where: eq(people.userId, userId),
    with: {
      loans: {
        with: {
          payments: true,
        },
      },
    },
    orderBy: [desc(people.updatedAt)],
  })

  // Calculate balance for each person
  const peopleWithBalances = allPeople.map((person) => {
    let balance = 0 // Positive = they owe me, Negative = I owe them

    for (const loan of person.loans) {
      const loanAmount = parseFloat(loan.amount)
      const totalPaid = loan.payments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      )
      const remaining = loanAmount - totalPaid

      if (loan.direction === 'lent') {
        // I lent money, they owe me
        balance += remaining
      } else {
        // I borrowed money, I owe them
        balance -= remaining
      }
    }

    const activeLoans = person.loans.filter((l) => !l.isSettled)

    return {
      ...person,
      balance,
      balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
      activeLoansCount: activeLoans.length,
      loans: undefined, // Don't send all loan details in list
    }
  })

  // Sort by absolute balance (biggest debts first)
  peopleWithBalances.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

  // Calculate global totals
  const totals = peopleWithBalances.reduce(
    (acc, p) => {
      if (p.balance > 0) acc.theyOweMe += p.balance
      if (p.balance < 0) acc.iOweThem += Math.abs(p.balance)
      return acc
    },
    { theyOweMe: 0, iOweThem: 0 }
  )

  return NextResponse.json({
    people: peopleWithBalances,
    totals: {
      ...totals,
      netBalance: totals.theyOweMe - totals.iOweThem,
    },
  })
}

// POST /api/people - Create new person
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const body = await request.json()

  const [person] = await db
    .insert(people)
    .values({
      userId,
      name: body.name,
      nickname: body.nickname,
      email: body.email,
      phone: body.phone,
      relationship: body.relationship,
      notes: body.notes,
    })
    .returning()

  return NextResponse.json(person, { status: 201 })
}
