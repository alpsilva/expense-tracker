'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, paymentMethodLabels } from '@/lib/formatters'

interface UpcomingExpense {
  id: string
  name: string
  amount: string
  dueDay: number | null
  dueMonth?: number | null
  paymentMethod: string
}

interface UpcomingPaymentsProps {
  monthly: UpcomingExpense[]
  yearly: UpcomingExpense[]
}

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

export function UpcomingPayments({ monthly, yearly }: UpcomingPaymentsProps) {
  const hasUpcoming = monthly.length > 0 || yearly.length > 0

  if (!hasUpcoming) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Próximos Vencimentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {monthly.map((expense) => (
          <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
            <div className="flex items-center gap-3">
              <span className="text-lg">{paymentMethodIcons[expense.paymentMethod]}</span>
              <div>
                <p className="font-medium">{expense.name}</p>
                <p className="text-sm text-muted-foreground">
                  Dia {expense.dueDay} • {paymentMethodLabels[expense.paymentMethod]}
                </p>
              </div>
            </div>
            <span className="font-bold">{formatCurrency(expense.amount)}</span>
          </div>
        ))}
        {yearly.map((expense) => (
          <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950">
            <div className="flex items-center gap-3">
              <span className="text-lg">{paymentMethodIcons[expense.paymentMethod]}</span>
              <div>
                <p className="font-medium">{expense.name}</p>
                <p className="text-sm text-muted-foreground">
                  Dia {expense.dueDay} (anual) • {paymentMethodLabels[expense.paymentMethod]}
                </p>
              </div>
            </div>
            <span className="font-bold">{formatCurrency(expense.amount)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
