import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { ExpenseForm } from '@/components/expenses/expense-form'
import { getExpenseById } from '@/lib/queries/expenses'

interface ExpenseDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function ExpenseDetailPage({ params }: ExpenseDetailPageProps) {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  if (!userId) {
    redirect('/login')
  }

  const { id } = await params
  const expense = await getExpenseById(userId, id)

  if (!expense) {
    notFound()
  }

  return (
    <div className="max-w-2xl mx-auto">
      <ExpenseForm expense={expense} />
    </div>
  )
}
