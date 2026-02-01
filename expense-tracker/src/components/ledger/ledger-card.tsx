'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { TransactionForm } from './transaction-form'

interface PersonWithBalance {
  id: string
  name: string
  nickname?: string | null
  email?: string | null
  phone?: string | null
  relationship?: string | null
  balance: number
  balanceDirection: 'they_owe_me' | 'i_owe_them' | 'settled'
  transactionCount: number
}

interface LedgerCardProps {
  person: PersonWithBalance
  onClick?: () => void
  onTransactionAdded?: () => void
}

export function LedgerCard({ person, onClick, onTransactionAdded }: LedgerCardProps) {
  const [lentOpen, setLentOpen] = useState(false)
  const [receivedOpen, setReceivedOpen] = useState(false)

  const balanceColor = person.balance > 0 ? 'text-green-600' : person.balance < 0 ? 'text-red-600' : 'text-muted-foreground'
  const balanceLabel = person.balance > 0 ? 'Me deve' : person.balance < 0 ? 'Eu devo' : 'Quitado'

  function handleQuickAction(e: React.MouseEvent, type: 'lent' | 'received') {
    e.stopPropagation()
    if (type === 'lent') {
      setLentOpen(true)
    } else {
      setReceivedOpen(true)
    }
  }

  return (
    <>
      <Card
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={onClick}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                👤
              </div>
              <div>
                <CardTitle className="text-base">{person.name}</CardTitle>
                {person.relationship && (
                  <p className="text-sm text-muted-foreground">{person.relationship}</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${balanceColor}`}>
                {balanceLabel}: {formatCurrency(Math.abs(person.balance))}
              </p>
              {person.transactionCount > 0 && (
                <Badge variant="secondary" className="mt-1">
                  {person.transactionCount} transaç{person.transactionCount > 1 ? 'ões' : 'ão'}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleQuickAction(e, 'lent')}
            >
              + Emprestei
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => handleQuickAction(e, 'received')}
            >
              + Recebi
            </Button>
          </div>
        </CardContent>
      </Card>

      <TransactionForm
        personId={person.id}
        type="lent"
        open={lentOpen}
        onOpenChange={setLentOpen}
        onSuccess={onTransactionAdded}
      />
      <TransactionForm
        personId={person.id}
        type="received"
        open={receivedOpen}
        onOpenChange={setReceivedOpen}
        onSuccess={onTransactionAdded}
      />
    </>
  )
}
