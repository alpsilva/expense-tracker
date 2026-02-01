import { NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses, people } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1

  // ============================================
  // RECURRING EXPENSES
  // ============================================
  const activeExpenses = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.isActive, true), eq(recurringExpenses.userId, userId)))

  const monthlyExpenses = activeExpenses.filter((e) => e.recurrence === 'monthly')
  const yearlyExpenses = activeExpenses.filter((e) => e.recurrence === 'yearly')

  const monthlyTotal = monthlyExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0
  )
  const yearlyTotal = yearlyExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0
  )

  // Upcoming payments (next 7 days for monthly, this month for yearly)
  const upcomingMonthly = monthlyExpenses.filter((e) => {
    if (!e.dueDay) return false
    const daysUntilDue = e.dueDay - currentDay
    return daysUntilDue >= 0 && daysUntilDue <= 7
  })

  const upcomingYearly = yearlyExpenses.filter((e) => {
    return e.dueMonth === currentMonth
  })

  // ============================================
  // LOANS (from transactions)
  // ============================================
  const allPeople = await db.query.people.findMany({
    where: eq(people.userId, userId),
    with: {
      transactions: true,
    },
  })

  let totalTheyOweMe = 0
  let totalIOweThem = 0
  let transactionCount = 0

  for (const person of allPeople) {
    let balance = 0
    for (const tx of person.transactions) {
      if (tx.disregarded) continue
      transactionCount++

      const amount = parseFloat(tx.amount)
      if (tx.type === 'lent') {
        balance += amount
      } else {
        balance -= amount
      }
    }

    if (balance > 0) {
      totalTheyOweMe += balance
    } else if (balance < 0) {
      totalIOweThem += Math.abs(balance)
    }
  }

  const peopleWithBalance = allPeople.filter((p) => {
    let balance = 0
    for (const tx of p.transactions) {
      if (tx.disregarded) continue
      const amount = parseFloat(tx.amount)
      if (tx.type === 'lent') balance += amount
      else balance -= amount
    }
    return balance !== 0
  }).length

  // ============================================
  // RESPONSE
  // ============================================
  return NextResponse.json({
    expenses: {
      monthly: {
        total: monthlyTotal,
        count: monthlyExpenses.length,
      },
      yearly: {
        total: yearlyTotal,
        count: yearlyExpenses.length,
        asMonthly: yearlyTotal / 12,
      },
      effectiveMonthly: monthlyTotal + yearlyTotal / 12,
      upcoming: {
        monthly: upcomingMonthly.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          dueDay: e.dueDay,
          paymentMethod: e.paymentMethod,
        })),
        yearly: upcomingYearly.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          dueDay: e.dueDay,
          dueMonth: e.dueMonth,
          paymentMethod: e.paymentMethod,
        })),
      },
    },
    loans: {
      theyOweMe: totalTheyOweMe,
      iOweThem: totalIOweThem,
      netBalance: totalTheyOweMe - totalIOweThem,
      transactionCount,
      peopleWithBalance,
    },
  })
}
