import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ExpensesSummary } from '@/components/dashboard/expenses-summary'
import { LoansSummary } from '@/components/dashboard/loans-summary'
import { UpcomingPayments } from '@/components/dashboard/upcoming-payments'
import { getDashboardData } from '@/lib/queries/dashboard'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  if (!userId) {
    redirect('/login')
  }

  const data = await getDashboardData(userId)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <ExpensesSummary
          monthly={data.expenses.monthly}
          yearly={data.expenses.yearly}
          effectiveMonthly={data.expenses.effectiveMonthly}
        />
        <LoansSummary
          theyOweMe={data.loans.theyOweMe}
          iOweThem={data.loans.iOweThem}
          netBalance={data.loans.netBalance}
          transactionCount={data.loans.transactionCount}
          peopleWithBalance={data.loans.peopleWithBalance}
        />
      </div>

      <UpcomingPayments
        monthly={data.expenses.upcoming.monthly}
        yearly={data.expenses.upcoming.yearly}
      />
    </div>
  )
}
