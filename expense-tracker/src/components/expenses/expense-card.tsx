'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDueDate, paymentMethodLabels, categoryLabels } from '@/lib/formatters'
import { cn } from '@/lib/utils'
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
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent/50',
        !expense.isActive && 'border-dashed bg-muted/50 text-muted-foreground shadow-none hover:bg-muted/70'
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{expense.name}</CardTitle>
              {!expense.isActive && <Badge variant="secondary">Inativa</Badge>}
            </div>
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
