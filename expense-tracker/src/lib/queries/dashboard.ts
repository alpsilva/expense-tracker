import { db } from '@/db'
import { recurringExpenses, people, paymentRecords } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'

export interface DuePayment {
  expenseId: string
  name: string
  amount: string
  dueDay: number
  paymentMethod: string
  year: number
  month: number
  isOverdue: boolean
  daysUntilDue: number
  recurrence: 'monthly' | 'yearly'
}

function computeDuePayments(
  activeExpenses: typeof recurringExpenses.$inferSelect[],
  paidRecords: typeof paymentRecords.$inferSelect[],
  now: Date
): { unpaid: DuePayment[]; paid: DuePayment[] } {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()

  // Index paid records for fast lookup
  const paidSet = new Set(
    paidRecords.map((r) => `${r.expenseId}-${r.year}-${r.month}`)
  )

  const unpaid: DuePayment[] = []
  const paid: DuePayment[] = []

  for (const expense of activeExpenses) {
    const startDate = new Date(expense.startDate)
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1

    const endDate = expense.endDate ? new Date(expense.endDate) : null
    const endYear = endDate ? endDate.getFullYear() : currentYear
    const endMonth = endDate ? endDate.getMonth() + 1 : currentMonth

    // Cap at current month
    const lastYear = Math.min(endYear, currentYear)
    const lastMonth = lastYear < currentYear ? endMonth : Math.min(endMonth, currentMonth)

    // Iterate through eligible months
    for (let y = startYear; y <= lastYear; y++) {
      const mStart = y === startYear ? startMonth : 1
      const mEnd = y === lastYear ? lastMonth : 12

      for (let m = mStart; m <= mEnd; m++) {
        // Yearly expenses only apply in their dueMonth (fall back to startDate month)
        if (expense.recurrence === 'yearly' && m !== (expense.dueMonth ?? startMonth)) {
          continue
        }

        const key = `${expense.id}-${y}-${m}`
        const isPaid = paidSet.has(key)

        // Calculate days until due for this specific month
        let daysUntilDue: number
        if (y < currentYear || (y === currentYear && m < currentMonth)) {
          // Past month — overdue by distance
          const dueDate = new Date(y, m - 1, expense.dueDay)
          daysUntilDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) * -1
        } else {
          // Current month
          daysUntilDue = expense.dueDay - currentDay
        }

        const isOverdue = daysUntilDue < 0

        const payment: DuePayment = {
          expenseId: expense.id,
          name: expense.name,
          amount: expense.amount,
          dueDay: expense.dueDay,
          paymentMethod: expense.paymentMethod,
          year: y,
          month: m,
          isOverdue,
          daysUntilDue,
          recurrence: expense.recurrence,
        }

        if (isPaid) {
          paid.push(payment)
        } else {
          unpaid.push(payment)
        }
      }
    }
  }

  // Sort unpaid: most overdue first → (year, month, dueDay) ascending
  unpaid.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if (a.month !== b.month) return a.month - b.month
    return a.dueDay - b.dueDay
  })

  // Sort paid: most recent first
  paid.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    if (a.month !== b.month) return b.month - a.month
    return b.dueDay - a.dueDay
  })

  return { unpaid, paid }
}

export async function getDashboardData(userId: string) {
  const now = new Date()

  // ============================================
  // RECURRING EXPENSES
  // ============================================
  const activeExpenses = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.isActive, true), eq(recurringExpenses.userId, userId)))

  // Fetch payment records for active expenses
  const expenseIds = activeExpenses.map((e) => e.id)
  const paidRecords = expenseIds.length > 0
    ? await db
        .select()
        .from(paymentRecords)
        .where(inArray(paymentRecords.expenseId, expenseIds))
    : []

  const { unpaid: duePayments, paid: paidPayments } = computeDuePayments(activeExpenses, paidRecords, now)

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

  return {
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
      duePayments,
      paidPayments,
    },
    loans: {
      theyOweMe: totalTheyOweMe,
      iOweThem: totalIOweThem,
      netBalance: totalTheyOweMe - totalIOweThem,
      transactionCount,
      peopleWithBalance,
    },
  }
}
