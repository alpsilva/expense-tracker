'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/lib/formatters'

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

interface PersonCardProps {
  person: PersonWithBalance
  onClick?: () => void
}

export function PersonCard({ person, onClick }: PersonCardProps) {
  const balanceColor = person.balance > 0 ? 'text-green-600' : person.balance < 0 ? 'text-red-600' : 'text-muted-foreground'
  const balanceLabel = person.balance > 0 ? 'Me deve' : person.balance < 0 ? 'Eu devo' : 'Quitado'

  return (
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
      {(person.email || person.phone) && (
        <CardContent className="pt-0">
          <div className="text-sm text-muted-foreground">
            {person.email && <span>{person.email}</span>}
            {person.email && person.phone && <span> • </span>}
            {person.phone && <span>{person.phone}</span>}
          </div>
        </CardContent>
      )}
    </Card>
  )
}
