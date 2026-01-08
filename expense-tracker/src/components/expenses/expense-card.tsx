'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDueDate, paymentMethodLabels, categoryLabels } from '@/lib/formatters'
import type { RecurringExpense } from '@/db/schema'

const paymentMethodIcons: Record<string, string> = {
  pix: '📱',
  credit_card: '💳',
  debit_card: '💳',
  boleto: '📄',
  automatic_debit: '🏦',
  bank_transfer: '🏦',
  cash: '💵',
  other: '💰',
}

interface ExpenseCardProps {
  expense: RecurringExpense
  onClick?: () => void
}

export function ExpenseCard({ expense, onClick }: ExpenseCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:bg-accent/50 transition-colors ${!expense.isActive ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">{expense.name}</CardTitle>
            {expense.description && (
              <p className="text-sm text-muted-foreground">{expense.description}</p>
            )}
          </div>
          <span className="text-lg font-bold">{formatCurrency(expense.amount)}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{categoryLabels[expense.category]}</Badge>
            <span className="text-muted-foreground">
              {expense.dueDay && formatDueDate(expense.dueDay, expense.dueMonth ?? undefined)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span>{paymentMethodIcons[expense.paymentMethod]}</span>
            <span className="text-muted-foreground">{paymentMethodLabels[expense.paymentMethod]}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
