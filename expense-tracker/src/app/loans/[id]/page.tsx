'use client'

import { useEffect, useState, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/formatters'
import { TransactionForm } from '@/components/ledger/transaction-form'

interface Transaction {
  id: string
  type: 'lent' | 'received'
  amount: string
  date: string
  description: string | null
  disregarded: boolean
  createdAt: string
}

interface PersonWithTransactions {
  id: string
  name: string
  nickname: string | null
  email: string | null
  phone: string | null
  relationship: string | null
  notes: string | null
  balance: number
  balanceDirection: 'they_owe_me' | 'i_owe_them' | 'settled'
  transactions: Transaction[]
}

export default function LedgerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [person, setPerson] = useState<PersonWithTransactions | null>(null)
  const [loading, setLoading] = useState(true)
  const [lentOpen, setLentOpen] = useState(false)
  const [receivedOpen, setReceivedOpen] = useState(false)

  const fetchData = useCallback(() => {
    fetch(`/api/people/${id}`)
      .then((res) => res.json())
      .then((data) => {
        setPerson(data)
        setLoading(false)
      })
  }, [id])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  async function handleToggleDisregard(txId: string, currentValue: boolean) {
    await fetch(`/api/people/${id}/transactions/${txId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ disregarded: !currentValue }),
    })
    fetchData()
  }

  async function handleDelete() {
    if (!confirm('Tem certeza que deseja excluir esta pessoa e todas as transações?')) return

    await fetch(`/api/people/${id}`, { method: 'DELETE' })
    router.push('/loans')
  }

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>
  }

  if (!person) {
    return <div className="text-center py-12">Pessoa não encontrada.</div>
  }

  const balanceColor = person.balance > 0 ? 'text-green-600' : person.balance < 0 ? 'text-red-600' : 'text-muted-foreground'
  const balanceLabel = person.balance > 0 ? 'Me deve' : person.balance < 0 ? 'Eu devo' : 'Quitado'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{person.name}</h1>
          {person.relationship && (
            <p className="text-muted-foreground">{person.relationship}</p>
          )}
        </div>
        <div className="text-right">
          <p className={`text-2xl font-bold ${balanceColor}`}>
            {balanceLabel}
          </p>
          <p className={`text-3xl font-bold ${balanceColor}`}>
            {formatCurrency(Math.abs(person.balance))}
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2">
        <Button onClick={() => setLentOpen(true)}>+ Emprestei</Button>
        <Button onClick={() => setReceivedOpen(true)}>+ Recebi</Button>
      </div>

      {/* Contact info */}
      {(person.email || person.phone || person.notes) && (
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm space-y-1">
              {person.email && <p>Email: {person.email}</p>}
              {person.phone && <p>Telefone: {person.phone}</p>}
              {person.notes && <p className="text-muted-foreground">{person.notes}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle>Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {person.transactions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma transação registrada.
            </p>
          ) : (
            <div className="space-y-3">
              {person.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    tx.disregarded ? 'opacity-50 bg-muted' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                      tx.type === 'lent'
                        ? 'bg-green-100 text-green-600'
                        : 'bg-red-100 text-red-600'
                    }`}>
                      {tx.type === 'lent' ? '↑' : '↓'}
                    </div>
                    <div>
                      <p className={`font-medium ${tx.disregarded ? 'line-through' : ''}`}>
                        {tx.type === 'lent' ? 'Emprestei' : 'Recebi'} {formatCurrency(parseFloat(tx.amount))}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(tx.date)}
                        {tx.description && ` • ${tx.description}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.disregarded && (
                      <Badge variant="outline">Desconsiderado</Badge>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className={`transition-all hover:scale-105 active:scale-95 ${
                        tx.disregarded
                          ? 'hover:bg-green-100 hover:text-green-700 dark:hover:bg-green-900 dark:hover:text-green-300'
                          : 'hover:bg-orange-100 hover:text-orange-700 dark:hover:bg-orange-900 dark:hover:text-orange-300'
                      }`}
                      onClick={() => handleToggleDisregard(tx.id, tx.disregarded)}
                    >
                      {tx.disregarded ? 'Restaurar' : 'Desconsiderar'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Link href="/loans">
          <Button variant="outline">← Voltar</Button>
        </Link>
        <Button variant="destructive" onClick={handleDelete}>
          Excluir Pessoa
        </Button>
      </div>

      {/* Transaction forms */}
      <TransactionForm
        personId={person.id}
        type="lent"
        open={lentOpen}
        onOpenChange={setLentOpen}
        onSuccess={fetchData}
      />
      <TransactionForm
        personId={person.id}
        type="received"
        open={receivedOpen}
        onOpenChange={setReceivedOpen}
        onSuccess={fetchData}
      />
    </div>
  )
}
