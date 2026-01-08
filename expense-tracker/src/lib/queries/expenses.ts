import { db } from '@/db'
import { recurringExpenses } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

interface GetExpensesListOptions {
  activeOnly?: boolean
  recurrence?: 'monthly' | 'yearly'
}

export async function getExpensesList(userId: string, options: GetExpensesListOptions = {}) {
  const { activeOnly, recurrence } = options

  const conditions = [eq(recurringExpenses.userId, userId)]
  if (activeOnly) conditions.push(eq(recurringExpenses.isActive, true))
  if (recurrence) conditions.push(eq(recurringExpenses.recurrence, recurrence))

  const expenses = await db
    .select()
    .from(recurringExpenses)
    .where(and(...conditions))
    .orderBy(recurringExpenses.dueDay, desc(recurringExpenses.createdAt))

  // Group by recurrence type
  const monthly = expenses.filter((e) => e.recurrence === 'monthly')
  const yearly = expenses.filter((e) => e.recurrence === 'yearly')

  // Calculate totals
  const monthlyTotal = monthly.reduce((sum, e) => sum + parseFloat(e.amount), 0)
  const yearlyTotal = yearly.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  return {
    expenses: {
      monthly,
      yearly,
    },
    totals: {
      monthly: monthlyTotal,
      yearly: yearlyTotal,
      yearlyAsMonthly: yearlyTotal / 12,
      effectiveMonthly: monthlyTotal + yearlyTotal / 12,
    },
  }
}

export async function getExpenseById(userId: string, id: string) {
  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, userId)))
    .limit(1)

  return expense ?? null
}
