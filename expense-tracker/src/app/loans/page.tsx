'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoanCard } from '@/components/loans/loan-card'
import { formatCurrency } from '@/lib/formatters'

interface LoanWithDetails {
  id: string
  personId: string
  direction: 'lent' | 'borrowed'
  amount: string
  currency: string
  reason: string
  transactionDate: string
  expectedSettlement: string | null
  isSettled: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  person: {
    id: string
    name: string
    nickname: string | null
  }
  totalPaid: number
  remaining: number
}

export default function LoansPage() {
  const router = useRouter()
  const [loans, setLoans] = useState<LoanWithDetails[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/loans')
      .then((res) => res.json())
      .then((data) => {
        setLoans(data)
        setLoading(false)
      })
  }, [])

  const activeLoans = loans.filter((l) => !l.isSettled)
  const settledLoans = loans.filter((l) => l.isSettled)
  const lentLoans = activeLoans.filter((l) => l.direction === 'lent')
  const borrowedLoans = activeLoans.filter((l) => l.direction === 'borrowed')

  const totalLent = lentLoans.reduce((sum, l) => sum + l.remaining, 0)
  const totalBorrowed = borrowedLoans.reduce((sum, l) => sum + l.remaining, 0)

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Empréstimos</h1>
        <Link href="/loans/new">
          <Button>+ Novo Empréstimo</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
          <p className="text-sm text-muted-foreground">Me devem</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalLent)}</p>
          <p className="text-sm text-muted-foreground">{lentLoans.length} empréstimo{lentLoans.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
          <p className="text-sm text-muted-foreground">Eu devo</p>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(totalBorrowed)}</p>
          <p className="text-sm text-muted-foreground">{borrowedLoans.length} empréstimo{borrowedLoans.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">Todos ({activeLoans.length})</TabsTrigger>
          <TabsTrigger value="lent">Emprestei ({lentLoans.length})</TabsTrigger>
          <TabsTrigger value="borrowed">Peguei ({borrowedLoans.length})</TabsTrigger>
          <TabsTrigger value="settled">Quitados ({settledLoans.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {activeLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan as never}
              onClick={() => router.push(`/loans/${loan.id}`)}
            />
          ))}
          {activeLoans.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Nenhum empréstimo ativo.</p>
          )}
        </TabsContent>

        <TabsContent value="lent" className="space-y-3 mt-4">
          {lentLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan as never}
              onClick={() => router.push(`/loans/${loan.id}`)}
            />
          ))}
          {lentLoans.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Nenhum empréstimo feito.</p>
          )}
        </TabsContent>

        <TabsContent value="borrowed" className="space-y-3 mt-4">
          {borrowedLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan as never}
              onClick={() => router.push(`/loans/${loan.id}`)}
            />
          ))}
          {borrowedLoans.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Nenhum empréstimo pegado.</p>
          )}
        </TabsContent>

        <TabsContent value="settled" className="space-y-3 mt-4">
          {settledLoans.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan as never}
              onClick={() => router.push(`/loans/${loan.id}`)}
            />
          ))}
          {settledLoans.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">Nenhum empréstimo quitado.</p>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
