import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

// GET /api/people - List all people with their balances
export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const allPeople = await db.query.people.findMany({
    where: eq(people.userId, userId),
    with: {
      transactions: true,
    },
    orderBy: [desc(people.updatedAt)],
  })

  // Calculate balance for each person from transactions
  const peopleWithBalances = allPeople.map((person) => {
    let balance = 0

    for (const tx of person.transactions) {
      if (tx.disregarded) continue

      const amount = parseFloat(tx.amount)
      if (tx.type === 'lent') {
        balance += amount // They owe me more
      } else {
        balance -= amount // They owe me less
      }
    }

    const transactionCount = person.transactions.filter(tx => !tx.disregarded).length

    return {
      ...person,
      balance,
      balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
      transactionCount,
      transactions: undefined, // Don't send all transactions in list
    }
  })

  // Sort by creation date (newest first), then alphabetically by name
  peopleWithBalances.sort((a, b) => {
    const dateCompare = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (dateCompare !== 0) return dateCompare
    return a.name.localeCompare(b.name)
  })

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
