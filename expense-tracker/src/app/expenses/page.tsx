import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ExpensesSection, InactiveExpensesSection } from '@/components/expenses/expenses-section'
import { getExpensesList } from '@/lib/queries/expenses'
import type { RecurringExpense } from '@/db/schema'

function getTotal(expenses: RecurringExpense[]) {
  return expenses.reduce((sum, expense) => sum + parseFloat(expense.amount), 0)
}

export default async function ExpensesPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  if (!userId) {
    redirect('/login')
  }

  const data = await getExpensesList(userId)
  const activeMonthly = data.expenses.monthly.filter((expense) => expense.isActive)
  const activeYearly = data.expenses.yearly.filter((expense) => expense.isActive)
  const inactiveExpenses = [
    ...data.expenses.monthly,
    ...data.expenses.yearly,
  ].filter((expense) => !expense.isActive)

  const hasActiveExpenses = activeMonthly.length > 0 || activeYearly.length > 0
  const hasAnyExpenses = hasActiveExpenses || inactiveExpenses.length > 0

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
          expenses={activeMonthly}
          total={getTotal(activeMonthly)}
        />
        <ExpensesSection
          title="Despesas Anuais"
          expenses={activeYearly}
          total={getTotal(activeYearly)}
        />
      </div>

      {!hasActiveExpenses && inactiveExpenses.length > 0 && (
        <div className="rounded-md border border-dashed bg-muted/30 p-6 text-center text-muted-foreground">
          Nenhuma despesa ativa.
        </div>
      )}

      {!hasAnyExpenses && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma despesa cadastrada.</p>
          <Link href="/expenses/new" className="text-primary hover:underline">
            Adicione sua primeira despesa
          </Link>
        </div>
      )}

      <InactiveExpensesSection expenses={inactiveExpenses} />
    </div>
  )
}
