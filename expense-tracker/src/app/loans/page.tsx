'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { LedgerCard } from '@/components/ledger/ledger-card'
import { formatCurrency } from '@/lib/formatters'

interface PersonWithBalance {
  id: string
  name: string
  nickname: string | null
  email: string | null
  phone: string | null
  relationship: string | null
  balance: number
  balanceDirection: 'they_owe_me' | 'i_owe_them' | 'settled'
  transactionCount: number
}

interface PeopleData {
  people: PersonWithBalance[]
  totals: {
    theyOweMe: number
    iOweThem: number
    netBalance: number
  }
}

export default function LoansPage() {
  const router = useRouter()
  const [data, setData] = useState<PeopleData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(() => {
    fetch('/api/people')
      .then((res) => res.json())
      .then((data) => {
        setData(data)
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Empréstimos</h1>
        <Link href="/loans/new">
          <Button>+ Nova Pessoa</Button>
        </Link>
      </div>

      {data && data.totals && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950">
            <p className="text-sm text-muted-foreground">Me devem</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(data.totals.theyOweMe)}</p>
          </div>
          <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950">
            <p className="text-sm text-muted-foreground">Eu devo</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(data.totals.iOweThem)}</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Saldo líquido</p>
            <p className={`text-2xl font-bold ${data.totals.netBalance > 0 ? 'text-green-600' : data.totals.netBalance < 0 ? 'text-red-600' : ''}`}>
              {data.totals.netBalance > 0 ? '+' : ''}{formatCurrency(data.totals.netBalance)}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {data?.people.map((person) => (
          <LedgerCard
            key={person.id}
            person={person}
            onClick={() => router.push(`/loans/${person.id}`)}
            onTransactionAdded={fetchData}
          />
        ))}
      </div>

      {data?.people.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>Nenhuma pessoa cadastrada.</p>
          <Link href="/loans/new" className="text-primary hover:underline">
            Adicione sua primeira pessoa
          </Link>
        </div>
      )}
    </div>
  )
}
