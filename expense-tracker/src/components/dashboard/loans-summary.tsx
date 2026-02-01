'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'

interface LoansSummaryProps {
  theyOweMe: number
  iOweThem: number
  netBalance: number
  transactionCount: number
  peopleWithBalance: number
}

export function LoansSummary({ theyOweMe, iOweThem, netBalance, transactionCount, peopleWithBalance }: LoansSummaryProps) {
  const netBalanceColor = netBalance > 0 ? 'text-green-600' : netBalance < 0 ? 'text-red-600' : 'text-muted-foreground'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empréstimos</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-sm text-muted-foreground">Me devem</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(theyOweMe)}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
            <p className="text-sm text-muted-foreground">Eu devo</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(iOweThem)}</p>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-muted">
          <p className="text-sm text-muted-foreground">Saldo líquido</p>
          <p className={`text-3xl font-bold ${netBalanceColor}`}>
            {netBalance > 0 ? '+' : ''}{formatCurrency(netBalance)}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {transactionCount} transaç{transactionCount !== 1 ? 'ões' : 'ão'} • {peopleWithBalance} pessoa{peopleWithBalance !== 1 ? 's' : ''}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
