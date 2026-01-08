'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import type { Loan, Person } from '@/db/schema'

interface LoanWithPerson extends Loan {
  person: Person
  totalPaid?: number
  remaining?: number
}

interface LoanCardProps {
  loan: LoanWithPerson
  onClick?: () => void
}

export function LoanCard({ loan, onClick }: LoanCardProps) {
  const remaining = loan.remaining ?? parseFloat(loan.amount)
  const totalPaid = loan.totalPaid ?? 0
  const progress = (totalPaid / parseFloat(loan.amount)) * 100

  return (
    <Card
      className={`cursor-pointer hover:bg-accent/50 transition-colors ${loan.isSettled ? 'opacity-60' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={loan.direction === 'lent' ? 'text-red-500' : 'text-green-500'}>
                {loan.direction === 'lent' ? '🔴' : '🟢'}
              </span>
              <CardTitle className="text-base">
                {loan.direction === 'lent' ? 'Emprestei para' : 'Peguei de'} {loan.person.name}
              </CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{loan.reason}</p>
          </div>
          <div className="text-right">
            <span className="text-lg font-bold">{formatCurrency(loan.amount)}</span>
            {loan.isSettled && (
              <Badge variant="secondary" className="ml-2">Quitado</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {formatDate(loan.transactionDate)}
            </span>
            <span>
              Pago: {formatCurrency(totalPaid)} | Resta: {formatCurrency(remaining)}
            </span>
          </div>
          {!loan.isSettled && (
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
