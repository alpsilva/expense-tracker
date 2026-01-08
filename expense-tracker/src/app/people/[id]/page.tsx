'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaymentForm } from '@/components/loans/payment-form'
import { formatCurrency, formatDate } from '@/lib/formatters'

interface LoanWithPayments {
  id: string
  direction: 'lent' | 'borrowed'
  amount: string
  reason: string
  transactionDate: string
  isSettled: boolean
  payments: Array<{
    id: string
    amount: string
    paidAt: string
  }>
  totalPaid: number
  remaining: number
}

interface PersonDetail {
  id: string
  name: string
  nickname: string | null
  email: string | null
  phone: string | null
  relationship: string | null
  notes: string | null
  loans: LoanWithPayments[]
  balance: number
  balanceDirection: 'they_owe_me' | 'i_owe_them' | 'settled'
}

interface PersonDetailPageProps {
  params: Promise<{ id: string }>
}

export default function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPerson()
  }, [id])

  function fetchPerson() {
    fetch(`/api/people/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((data) => {
        setPerson(data)
        setLoading(false)
      })
      .catch(() => {
        router.push('/people')
      })
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta pessoa? Todos os empréstimos associados serão excluídos.')) return

    const res = await fetch(`/api/people/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/people')
    }
  }

  if (loading || !person) {
    return <div className="text-center py-12">Carregando...</div>
  }

  const balanceColor = person.balance > 0 ? 'text-green-600' : person.balance < 0 ? 'text-red-600' : 'text-muted-foreground'
  const balanceLabel = person.balance > 0 ? 'Me deve' : person.balance < 0 ? 'Eu devo' : 'Quitado'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl">
                👤
              </div>
              <div>
                <CardTitle className="text-2xl">{person.name}</CardTitle>
                {person.relationship && (
                  <p className="text-muted-foreground">{person.relationship}</p>
                )}
                <div className="flex gap-2 mt-1 text-sm text-muted-foreground">
                  {person.email && <span>{person.email}</span>}
                  {person.email && person.phone && <span>•</span>}
                  {person.phone && <span>{person.phone}</span>}
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-4 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">Saldo</p>
            <p className={`text-3xl font-bold ${balanceColor}`}>
              {balanceLabel}: {formatCurrency(Math.abs(person.balance))}
            </p>
          </div>

          {person.notes && (
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Observações</p>
              <p>{person.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Empréstimos</CardTitle>
          <Link href={`/loans/new?personId=${person.id}`}>
            <Button size="sm">+ Novo Empréstimo</Button>
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          {person.loans.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">
              Nenhum empréstimo com esta pessoa.
            </p>
          ) : (
            person.loans.map((loan, index) => (
              <div key={loan.id}>
                {index > 0 && <Separator className="my-4" />}
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={loan.direction === 'lent' ? 'text-red-500' : 'text-green-500'}>
                          {loan.direction === 'lent' ? '🔴 Emprestei' : '🟢 Peguei'}
                        </span>
                        <span className="font-bold">{formatCurrency(loan.amount)}</span>
                        {loan.isSettled && <Badge variant="secondary">Quitado</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {loan.reason} • {formatDate(loan.transactionDate)}
                      </p>
                    </div>
                  </div>

                  {!loan.isSettled && (
                    <div className="flex items-center justify-between text-sm">
                      <span>
                        Pago: {formatCurrency(loan.totalPaid)} | Resta: {formatCurrency(loan.remaining)}
                      </span>
                      <PaymentForm
                        loanId={loan.id}
                        remaining={loan.remaining}
                        onSuccess={fetchPerson}
                      />
                    </div>
                  )}

                  {loan.payments.length > 0 && (
                    <div className="pl-4 border-l-2 space-y-1">
                      {loan.payments.map((payment) => (
                        <p key={payment.id} className="text-sm text-muted-foreground">
                          {formatCurrency(payment.amount)} em {formatDate(payment.paidAt)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
        <Link href={`/people/${person.id}/edit`}>
          <Button variant="outline">Editar</Button>
        </Link>
        <Button variant="destructive" onClick={handleDelete}>
          Excluir
        </Button>
      </div>
    </div>
  )
}
