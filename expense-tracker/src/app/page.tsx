import { ExpensesSummary } from '@/components/dashboard/expenses-summary'
import { LoansSummary } from '@/components/dashboard/loans-summary'
import { UpcomingPayments } from '@/components/dashboard/upcoming-payments'

async function getDashboardData() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/dashboard`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    throw new Error('Failed to fetch dashboard data')
  }

  return res.json()
}

export default async function DashboardPage() {
  const data = await getDashboardData()

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
          activeLoansCount={data.loans.activeLoansCount}
          peopleWithActiveLoans={data.loans.peopleWithActiveLoans}
        />
      </div>

      <UpcomingPayments
        monthly={data.expenses.upcoming.monthly}
        yearly={data.expenses.upcoming.yearly}
      />
    </div>
  )
}
