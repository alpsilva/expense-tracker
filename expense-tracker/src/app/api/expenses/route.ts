import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

// GET /api/expenses - List all expenses, segmented by recurrence
export async function GET(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const searchParams = request.nextUrl.searchParams
  const activeOnly = searchParams.get('active') === 'true'
  const recurrence = searchParams.get('recurrence') as 'monthly' | 'yearly' | null

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

  return NextResponse.json({
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
  })
}

// POST /api/expenses - Create new expense
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const body = await request.json()

  const [expense] = await db
    .insert(recurringExpenses)
    .values({
      userId,
      name: body.name,
      description: body.description,
      amount: body.amount.toString(),
      currency: body.currency || 'BRL',
      category: body.category || 'other',
      recurrence: body.recurrence,
      paymentMethod: body.paymentMethod,
      dueDay: body.dueDay,
      dueMonth: body.dueMonth,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes,
      url: body.url,
      isActive: body.isActive ?? true,
    })
    .returning()

  return NextResponse.json(expense, { status: 201 })
}
