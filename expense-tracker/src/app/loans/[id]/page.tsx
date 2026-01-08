'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PaymentForm } from '@/components/loans/payment-form'
import { formatCurrency, formatDate, paymentMethodLabels } from '@/lib/formatters'

interface LoanDetail {
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
  person: {
    id: string
    name: string
    nickname: string | null
    relationship: string | null
  }
  payments: Array<{
    id: string
    amount: string
    paidAt: string
    method: string | null
    notes: string | null
  }>
  totalPaid: number
  remaining: number
}

interface LoanDetailPageProps {
  params: Promise<{ id: string }>
}

export default function LoanDetailPage({ params }: LoanDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [loan, setLoan] = useState<LoanDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLoan()
  }, [id])

  function fetchLoan() {
    fetch(`/api/loans/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Not found')
        return res.json()
      })
      .then((data) => {
        setLoan(data)
        setLoading(false)
      })
      .catch(() => {
        router.push('/loans')
      })
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir este empréstimo?')) return

    const res = await fetch(`/api/loans/${id}`, { method: 'DELETE' })
    if (res.ok) {
      router.push('/loans')
    }
  }

  async function handleSettle() {
    const res = await fetch(`/api/loans/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isSettled: true }),
    })
    if (res.ok) {
      fetchLoan()
    }
  }

  if (loading || !loan) {
    return <div className="text-center py-12">Carregando...</div>
  }

  const progress = (loan.totalPaid / parseFloat(loan.amount)) * 100

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={loan.direction === 'lent' ? 'text-red-500' : 'text-green-500'}>
                  {loan.direction === 'lent' ? '🔴' : '🟢'}
                </span>
                <CardTitle>
                  {loan.direction === 'lent' ? 'Emprestei para' : 'Peguei de'} {loan.person.name}
                </CardTitle>
              </div>
              {loan.person.relationship && (
                <p className="text-sm text-muted-foreground mt-1">{loan.person.relationship}</p>
              )}
            </div>
            {loan.isSettled && <Badge variant="secondary">Quitado</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">Motivo</p>
            <p className="font-medium">{loan.reason}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Valor Total</p>
              <p className="text-2xl font-bold">{formatCurrency(loan.amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Data</p>
              <p className="font-medium">{formatDate(loan.transactionDate)}</p>
            </div>
          </div>

          {!loan.isSettled && (
            <>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Pago: {formatCurrency(loan.totalPaid)}</span>
                  <span>Resta: {formatCurrency(loan.remaining)}</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-3">
                  <div
                    className="bg-primary h-3 rounded-full transition-all"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <PaymentForm
                  loanId={loan.id}
                  remaining={loan.remaining}
                  onSuccess={fetchLoan}
                />
                <Button variant="outline" onClick={handleSettle}>
                  Marcar como Quitado
                </Button>
              </div>
            </>
          )}

          {loan.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Observações</p>
              <p>{loan.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {loan.payments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Pagamentos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loan.payments.map((payment, index) => (
              <div key={payment.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{formatCurrency(payment.amount)}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(payment.paidAt)}
                      {payment.method && ` • ${paymentMethodLabels[payment.method]}`}
                    </p>
                    {payment.notes && (
                      <p className="text-sm text-muted-foreground">{payment.notes}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => router.back()}>
          Voltar
        </Button>
        <Button variant="destructive" onClick={handleDelete}>
          Excluir
        </Button>
      </div>
    </div>
  )
}
