'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ExpenseCard } from './expense-card'
import { formatCurrency } from '@/lib/formatters'
import type { RecurringExpense } from '@/db/schema'
import { useRouter } from 'next/navigation'

interface ExpensesSectionProps {
  title: string
  expenses: RecurringExpense[]
  total: number
}

export function ExpensesSection({ title, expenses, total }: ExpensesSectionProps) {
  const router = useRouter()

  if (expenses.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <span className="text-lg font-bold text-muted-foreground">
          Total: {formatCurrency(total)}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            onClick={() => router.push(`/expenses/${expense.id}`)}
          />
        ))}
      </CardContent>
    </Card>
  )
}
