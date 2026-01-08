import { notFound } from 'next/navigation'
import { ExpenseForm } from '@/components/expenses/expense-form'

async function getExpense(id: string) {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/api/expenses/${id}`, {
    cache: 'no-store',
  })

  if (!res.ok) {
    if (res.status === 404) {
      return null
    }
    throw new Error('Failed to fetch expense')
  }

  return res.json()
}

interface ExpenseDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const { id } = await params
  const expense = await getExpense(id)

  if (!expense) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ExpenseForm expense={expense} />
    </div>
  )
}
