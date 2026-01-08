import { NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses, loans } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1

  // ============================================
  // RECURRING EXPENSES
  // ============================================
  const activeExpenses = await db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.isActive, true))

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
  // LOANS
  // ============================================
  const allPeople = await db.query.people.findMany({
    with: {
      loans: {
        where: eq(loans.isSettled, false),
        with: { payments: true },
      },
    },
  })

  let totalTheyOweMe = 0
  let totalIOweThem = 0

  for (const person of allPeople) {
    for (const loan of person.loans) {
      const remaining =
        parseFloat(loan.amount) -
        loan.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

      if (loan.direction === 'lent') {
        totalTheyOweMe += remaining
      } else {
        totalIOweThem += remaining
      }
    }
  }

  const activeLoansCount = allPeople.reduce(
    (sum, p) => sum + p.loans.length,
    0
  )

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
      activeLoansCount,
      peopleWithActiveLoans: allPeople.filter((p) => p.loans.length > 0).length,
    },
  })
}
