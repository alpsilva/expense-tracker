import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ExpensesSection } from '@/components/expenses/expenses-section'

async function getExpenses() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/expenses`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch expenses')
  }

  return res.json()
}

export default async function ExpensesPage() {
  const data = await getExpenses()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Despesas Recorrentes</h1>
        <Link href="/expenses/new">
          <Button>+ Nova Despesa</Button>
        </Link>
      </div>

      <div className="space-y-6">
        <ExpensesSection
          title="Despesas Mensais"
          expenses={data.expenses.monthly}
          total={data.totals.monthly}
        />
        <ExpensesSection
          title="Despesas Anuais"
          expenses={data.expenses.yearly}
          total={data.totals.yearly}
        />
      </div>

      {data.expenses.monthly.length === 0 && data.expenses.yearly.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma despesa cadastrada.</p>
          <Link href="/expenses/new" className="text-primary hover:underline">
            Adicione sua primeira despesa
          </Link>
        </div>
      )}
    </div>
  )
}
