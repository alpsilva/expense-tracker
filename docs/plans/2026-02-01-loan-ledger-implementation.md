# Loan Ledger Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the loans system with a simpler ledger model where each person has a flat list of transactions.

**Architecture:** New `transactions` table replaces `loans` and `loan_payments`. The `/loans` page becomes a people-first view showing ledgers. Each person's page shows their transaction history with quick-add dialogs.

**Tech Stack:** Next.js App Router, Drizzle ORM, Neon PostgreSQL, React client components, Radix UI dialogs

---

## Task 1: Add transactions table to schema

**Files:**
- Modify: `expense-tracker/src/db/schema.ts`

**Step 1: Add the transaction type enum and table**

Add after the existing enums (around line 50):

```typescript
export const transactionTypeEnum = pgEnum('transaction_type', [
  'lent',
  'received',
])
```

Add after the `loanPayments` table (around line 173):

```typescript
// ============================================
// TRANSACTIONS (new ledger model)
// ============================================

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  personId: text('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),

  type: transactionTypeEnum('type').notNull(),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  date: timestamp('date', { withTimezone: true }).notNull(),
  description: text('description'),
  disregarded: boolean('disregarded').default(false).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
```

**Step 2: Add relations**

Add after `loanPaymentsRelations`:

```typescript
export const transactionsRelations = relations(transactions, ({ one }) => ({
  person: one(people, {
    fields: [transactions.personId],
    references: [people.id],
  }),
}))
```

Update `peopleRelations` to include transactions:

```typescript
export const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(users, {
    fields: [people.userId],
    references: [users.id],
  }),
  loans: many(loans),
  transactions: many(transactions),
}))
```

**Step 3: Add type exports**

Add at end of file:

```typescript
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
```

**Step 4: Generate and apply migration**

Run:
```bash
pnpm db:generate
```

Review the generated SQL in `drizzle/` folder, then:
```bash
pnpm db:migrate
```

---

## Task 2: Create transactions API endpoint

**Files:**
- Create: `expense-tracker/src/app/api/people/[id]/transactions/route.ts`

**Step 1: Create the transactions route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions, people } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST /api/people/:id/transactions - Create transaction
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: personId } = await context.params
  const body = await request.json()

  // Verify person belongs to user
  const person = await db.query.people.findFirst({
    where: and(eq(people.id, personId), eq(people.userId, userId)),
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  const [transaction] = await db
    .insert(transactions)
    .values({
      personId,
      type: body.type,
      amount: body.amount.toString(),
      date: new Date(body.date),
      description: body.description || null,
    })
    .returning()

  // Update person's updatedAt
  await db
    .update(people)
    .set({ updatedAt: new Date() })
    .where(eq(people.id, personId))

  return NextResponse.json(transaction, { status: 201 })
}
```

---

## Task 3: Create transaction update endpoint (for disregard toggle)

**Files:**
- Create: `expense-tracker/src/app/api/people/[id]/transactions/[txId]/route.ts`

**Step 1: Create the single transaction route file**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { transactions, people } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string; txId: string }>
}

// PATCH /api/people/:id/transactions/:txId - Update transaction
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: personId, txId } = await context.params
  const body = await request.json()

  // Verify person belongs to user
  const person = await db.query.people.findFirst({
    where: and(eq(people.id, personId), eq(people.userId, userId)),
  })

  if (!person) {
    return NextResponse.json({ error: 'Person not found' }, { status: 404 })
  }

  // Update transaction
  const [transaction] = await db
    .update(transactions)
    .set({
      disregarded: body.disregarded,
    })
    .where(and(eq(transactions.id, txId), eq(transactions.personId, personId)))
    .returning()

  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 })
  }

  return NextResponse.json(transaction)
}
```

---

## Task 4: Update people API to use transactions for balance

**Files:**
- Modify: `expense-tracker/src/app/api/people/route.ts`
- Modify: `expense-tracker/src/app/api/people/[id]/route.ts`

**Step 1: Update GET /api/people to calculate balance from transactions**

Replace the entire file with:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people } from '@/db/schema'
import { desc, eq } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

// GET /api/people - List all people with their balances
export async function GET() {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const allPeople = await db.query.people.findMany({
    where: eq(people.userId, userId),
    with: {
      transactions: true,
    },
    orderBy: [desc(people.updatedAt)],
  })

  // Calculate balance for each person from transactions
  const peopleWithBalances = allPeople.map((person) => {
    let balance = 0

    for (const tx of person.transactions) {
      if (tx.disregarded) continue

      const amount = parseFloat(tx.amount)
      if (tx.type === 'lent') {
        balance += amount // They owe me more
      } else {
        balance -= amount // They owe me less
      }
    }

    const transactionCount = person.transactions.filter(tx => !tx.disregarded).length

    return {
      ...person,
      balance,
      balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
      transactionCount,
      transactions: undefined, // Don't send all transactions in list
    }
  })

  // Sort by absolute balance (biggest first)
  peopleWithBalances.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))

  // Calculate global totals
  const totals = peopleWithBalances.reduce(
    (acc, p) => {
      if (p.balance > 0) acc.theyOweMe += p.balance
      if (p.balance < 0) acc.iOweThem += Math.abs(p.balance)
      return acc
    },
    { theyOweMe: 0, iOweThem: 0 }
  )

  return NextResponse.json({
    people: peopleWithBalances,
    totals: {
      ...totals,
      netBalance: totals.theyOweMe - totals.iOweThem,
    },
  })
}

// POST /api/people - Create new person
export async function POST(request: NextRequest) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const body = await request.json()

  const [person] = await db
    .insert(people)
    .values({
      userId,
      name: body.name,
      nickname: body.nickname,
      email: body.email,
      phone: body.phone,
      relationship: body.relationship,
      notes: body.notes,
    })
    .returning()

  return NextResponse.json(person, { status: 201 })
}
```

**Step 2: Update GET /api/people/:id to return transactions**

Replace the GET function in the file:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people, transactions } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// GET /api/people/:id - Get person with all transactions and computed balance
export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  const person = await db.query.people.findFirst({
    where: and(eq(people.id, id), eq(people.userId, userId)),
    with: {
      transactions: {
        orderBy: [desc(transactions.date)],
      },
    },
  })

  if (!person) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Calculate balance from transactions
  let balance = 0
  for (const tx of person.transactions) {
    if (tx.disregarded) continue

    const amount = parseFloat(tx.amount)
    if (tx.type === 'lent') {
      balance += amount
    } else {
      balance -= amount
    }
  }

  return NextResponse.json({
    ...person,
    balance,
    balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
  })
}

// PUT /api/people/:id
export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params
  const body = await request.json()

  const [person] = await db
    .update(people)
    .set({
      name: body.name,
      nickname: body.nickname,
      email: body.email,
      phone: body.phone,
      relationship: body.relationship,
      notes: body.notes,
      updatedAt: new Date(),
    })
    .where(and(eq(people.id, id), eq(people.userId, userId)))
    .returning()

  return NextResponse.json(person)
}

// DELETE /api/people/:id
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id } = await context.params

  await db.delete(people).where(and(eq(people.id, id), eq(people.userId, userId)))
  return NextResponse.json({ success: true })
}
```

---

## Task 5: Create TransactionForm component

**Files:**
- Create: `expense-tracker/src/components/ledger/transaction-form.tsx`

**Step 1: Create the transaction form dialog**

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface TransactionFormProps {
  personId: string
  type: 'lent' | 'received'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TransactionForm({
  personId,
  type,
  open,
  onOpenChange,
  onSuccess
}: TransactionFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    description: '',
  })

  const typeLabel = type === 'lent' ? 'Emprestei' : 'Recebi'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        type,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString(),
        description: formData.description || null,
      }

      const res = await fetch(`/api/people/${personId}/transactions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setFormData({
          amount: '',
          date: new Date().toISOString().split('T')[0],
          description: '',
        })
        onOpenChange(false)
        onSuccess?.()
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{typeLabel}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="txAmount">Valor (R$)</Label>
              <Input
                id="txAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                autoFocus
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="txDate">Data</Label>
              <Input
                id="txDate"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="txDescription">Descrição (opcional)</Label>
            <Textarea
              id="txDescription"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Ex: Conserto do carro"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

---

## Task 6: Create LedgerCard component

**Files:**
- Create: `expense-tracker/src/components/ledger/ledger-card.tsx`

**Step 1: Create the ledger card for the people list**

```typescript
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
```

---

## Task 7: Update loans page to use ledger view

**Files:**
- Modify: `expense-tracker/src/app/loans/page.tsx`

**Step 1: Replace with people-first ledger view**

Replace the entire file:

```typescript
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
```

---

## Task 8: Create ledger detail page

**Files:**
- Modify: `expense-tracker/src/app/loans/[id]/page.tsx`

**Step 1: Replace with ledger detail view**

Replace the entire file:

```typescript
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
```

---

## Task 9: Update new loan page to create person

**Files:**
- Modify: `expense-tracker/src/app/loans/new/page.tsx`

**Step 1: Replace with person creation form**

Replace the entire file:

```typescript
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewPersonPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    relationship: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const res = await fetch('/api/people', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          nickname: formData.nickname || null,
          email: formData.email || null,
          phone: formData.phone || null,
          relationship: formData.relationship || null,
          notes: formData.notes || null,
        }),
      })

      if (res.ok) {
        const person = await res.json()
        router.push(`/loans/${person.id}`)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Nova Pessoa</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome da pessoa"
                required
              />
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nickname">Apelido</Label>
                <Input
                  id="nickname"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  placeholder="Como você chama"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship">Relação</Label>
                <Input
                  id="relationship"
                  value={formData.relationship}
                  onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                  placeholder="Ex: Amigo, Colega"
                />
              </div>
            </div>

            <div className="grid gap-4 grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(11) 99999-9999"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais..."
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={loading}>
                {loading ? 'Salvando...' : 'Criar Pessoa'}
              </Button>
              <Link href="/loans">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
```

---

## Task 10: Clean up old loans components and API routes

**Files:**
- Delete: `expense-tracker/src/app/api/loans/route.ts`
- Delete: `expense-tracker/src/app/api/loans/[id]/route.ts`
- Delete: `expense-tracker/src/app/api/loans/[id]/payments/route.ts`
- Delete: `expense-tracker/src/components/loans/loan-card.tsx`
- Delete: `expense-tracker/src/components/loans/loan-form.tsx`
- Delete: `expense-tracker/src/components/loans/payment-form.tsx`

**Step 1: Delete the old files**

Run:
```bash
rm expense-tracker/src/app/api/loans/route.ts
rm expense-tracker/src/app/api/loans/[id]/route.ts
rm expense-tracker/src/app/api/loans/[id]/payments/route.ts
rm expense-tracker/src/components/loans/loan-card.tsx
rm expense-tracker/src/components/loans/loan-form.tsx
rm expense-tracker/src/components/loans/payment-form.tsx
rmdir expense-tracker/src/app/api/loans/[id]
rmdir expense-tracker/src/app/api/loans
rmdir expense-tracker/src/components/loans
```

---

## Task 11: Remove old schema definitions (optional - can keep for reference)

**Files:**
- Modify: `expense-tracker/src/db/schema.ts`

**Step 1: Remove old loans and loanPayments tables**

Remove:
- `loans` table definition
- `loanPayments` table definition
- `loansRelations`
- `loanPaymentsRelations`
- Related type exports (Loan, NewLoan, LoanPayment, NewLoanPayment)

Update `peopleRelations` to remove `loans: many(loans)`:

```typescript
export const peopleRelations = relations(people, ({ one, many }) => ({
  user: one(users, {
    fields: [people.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}))
```

**Step 2: Generate migration for dropping old tables**

Run:
```bash
pnpm db:generate
```

Review the migration, then:
```bash
pnpm db:migrate
```

---

## Task 12: Update dashboard to use new transactions model

**Files:**
- Modify: `expense-tracker/src/components/dashboard/loans-summary.tsx`
- Modify: `expense-tracker/src/lib/queries/dashboard.ts` (if exists)

This task depends on how the dashboard currently queries loan data. The summary should now calculate totals from transactions instead of loans.

**Step 1: Update loans-summary component**

Update to fetch from `/api/people` and display totals from that endpoint, which now calculates balances from transactions.

---

## Summary

After completing all tasks:

1. New `transactions` table replaces `loans` + `loan_payments`
2. `/loans` page shows people with ledger cards and quick-add buttons
3. `/loans/[id]` shows person's transaction history with disregard toggle
4. `/loans/new` creates a new person (ledger)
5. Old loans API and components are removed
6. Dashboard updated to use new data model
