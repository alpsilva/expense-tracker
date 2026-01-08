'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency } from '@/lib/formatters'

interface ExpensesSummaryProps {
  monthly: {
    total: number
    count: number
  }
  yearly: {
    total: number
    count: number
    asMonthly: number
  }
  effectiveMonthly: number
}

export function ExpensesSummary({ monthly, yearly, effectiveMonthly }: ExpensesSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos Recorrentes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Mensais</p>
            <p className="text-2xl font-bold">{formatCurrency(monthly.total)}/mês</p>
            <p className="text-sm text-muted-foreground">{monthly.count} despesa{monthly.count !== 1 ? 's' : ''}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Anuais</p>
            <p className="text-2xl font-bold">{formatCurrency(yearly.total)}/ano</p>
            <p className="text-sm text-muted-foreground">
              ({formatCurrency(yearly.asMonthly)}/mês) • {yearly.count} despesa{yearly.count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
          <p className="text-sm text-muted-foreground">Custo mensal efetivo</p>
          <p className="text-3xl font-bold text-primary">{formatCurrency(effectiveMonthly)}</p>
        </div>
      </CardContent>
    </Card>
  )
}
