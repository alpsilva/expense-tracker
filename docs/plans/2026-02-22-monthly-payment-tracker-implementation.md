# Monthly Payment Tracker — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let users mark recurring expenses as paid each month, with urgency-sorted display on the dashboard.

**Architecture:** New `paymentRecords` table (absence = unpaid). Dashboard computes due payments on load by cross-referencing active expenses with existing records. Two API endpoints for mark/unmark. New `DuePayments` client component replaces `UpcomingPayments`.

**Tech Stack:** Next.js 16 App Router, Drizzle ORM, Neon PostgreSQL, Tailwind CSS v4, shadcn/ui components

**Design doc:** `docs/plans/2026-02-22-monthly-payment-tracker-design.md`

---

### Task 1: Add `paymentRecords` table to schema

**Files:**
- Modify: `expense-tracker/src/db/schema.ts`

**Step 1: Add the table, unique index, relations, and type exports**

Add after the `transactions` table definition (after line 149):

```typescript
import { uniqueIndex } from 'drizzle-orm/pg-core'
```

(Add `uniqueIndex` to the existing import from `drizzle-orm/pg-core` on line 1)

```typescript
// ============================================
// PAYMENT RECORDS (tracking paid recurring expenses)
// ============================================

export const paymentRecords = pgTable('payment_records', {
  id: text('id').primaryKey().$defaultFn(() => createId()),

  expenseId: text('expense_id').notNull().references(() => recurringExpenses.id, { onDelete: 'cascade' }),

  year: integer('year').notNull(),
  month: integer('month').notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('payment_records_expense_year_month_idx').on(table.expenseId, table.year, table.month),
])
```

Add relations (after `transactionsRelations`):

```typescript
export const paymentRecordsRelations = relations(paymentRecords, ({ one }) => ({
  expense: one(recurringExpenses, {
    fields: [paymentRecords.expenseId],
    references: [recurringExpenses.id],
  }),
}))
```

Update `recurringExpensesRelations` to include `paymentRecords`:

```typescript
export const recurringExpensesRelations = relations(recurringExpenses, ({ one, many }) => ({
  user: one(users, {
    fields: [recurringExpenses.userId],
    references: [users.id],
  }),
  paymentRecords: many(paymentRecords),
}))
```

Add type exports at the bottom:

```typescript
export type PaymentRecord = typeof paymentRecords.$inferSelect
export type NewPaymentRecord = typeof paymentRecords.$inferInsert
```

**Step 2: Make `dueDay` NOT NULL in schema definition**

Change line 95 from:
```typescript
  dueDay: integer('due_day'),
```
to:
```typescript
  dueDay: integer('due_day').notNull(),
```

Change line 96 from:
```typescript
  dueMonth: integer('due_month'),
```
to:
```typescript
  dueMonth: integer('due_month'),  // Required for yearly, nullable for monthly
```

Note: Keep `dueMonth` nullable — it's only meaningful for yearly expenses.

**Step 3: Generate migration**

Run: `cd /Users/alpsilva/projects/expense-tracker/expense-tracker && pnpm db:generate`

**Step 4: Edit the generated migration SQL**

The generated migration will try to add NOT NULL to `due_day` directly, which will fail if there are null values. Edit the generated SQL file to add a backfill step BEFORE the NOT NULL constraint:

Find the line that alters `due_day` to NOT NULL and add before it:

```sql
UPDATE "recurring_expenses" SET "due_day" = 1 WHERE "due_day" IS NULL;
```

**Step 5: Apply migration locally**

Run: `cd /Users/alpsilva/projects/expense-tracker/expense-tracker && pnpm db:migrate`

Verify it succeeds without errors.

**Step 6: Commit**

```bash
git add expense-tracker/src/db/schema.ts expense-tracker/drizzle/
git commit -m "feat(schema): add paymentRecords table and make dueDay NOT NULL"
```

---

### Task 2: Payment API — mark as paid (POST)

**Files:**
- Create: `expense-tracker/src/app/api/expenses/[id]/payments/route.ts`

**Step 1: Create the POST handler**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses, paymentRecords } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { getAuthUserId, unauthorizedResponse } from '@/lib/api-auth'

type RouteContext = {
  params: Promise<{ id: string }>
}

// POST /api/expenses/:id/payments — Mark expense as paid for a month
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: expenseId } = await context.params
  const body = await request.json()

  // Validate year
  const year = Number(body.year)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: 'Invalid year.' },
      { status: 400 }
    )
  }

  // Validate month
  const month = Number(body.month)
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid month. Must be 1-12.' },
      { status: 400 }
    )
  }

  // Verify expense belongs to user
  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)))
    .limit(1)

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  // Check if already paid (idempotent)
  const existing = await db.query.paymentRecords.findFirst({
    where: and(
      eq(paymentRecords.expenseId, expenseId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.month, month),
    ),
  })

  if (existing) {
    return NextResponse.json(existing, { status: 200 })
  }

  // Create payment record
  const [record] = await db
    .insert(paymentRecords)
    .values({
      expenseId,
      year,
      month,
      paidAt: new Date(),
    })
    .returning()

  return NextResponse.json(record, { status: 201 })
}
```

**Step 2: Verify the route works**

Run the dev server: `pnpm dev`

Test with curl (replace `EXPENSE_ID` and cookie):
```bash
curl -X POST http://localhost:3000/api/expenses/EXPENSE_ID/payments \
  -H "Content-Type: application/json" \
  -H "Cookie: userId=YOUR_USER_ID" \
  -d '{"year": 2026, "month": 2}'
```

Expected: `201` with the created record JSON.

**Step 3: Commit**

```bash
git add expense-tracker/src/app/api/expenses/\[id\]/payments/
git commit -m "feat(api): add POST /api/expenses/:id/payments to mark as paid"
```

---

### Task 3: Payment API — unmark payment (DELETE)

**Files:**
- Modify: `expense-tracker/src/app/api/expenses/[id]/payments/route.ts`

**Step 1: Add the DELETE handler**

Add to the same file, after the POST handler:

```typescript
// DELETE /api/expenses/:id/payments — Unmark expense payment for a month
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const userId = await getAuthUserId()
  if (!userId) return unauthorizedResponse()

  const { id: expenseId } = await context.params
  const body = await request.json()

  // Validate year
  const year = Number(body.year)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return NextResponse.json(
      { error: 'Invalid year.' },
      { status: 400 }
    )
  }

  // Validate month
  const month = Number(body.month)
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json(
      { error: 'Invalid month. Must be 1-12.' },
      { status: 400 }
    )
  }

  // Verify expense belongs to user
  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(and(eq(recurringExpenses.id, expenseId), eq(recurringExpenses.userId, userId)))
    .limit(1)

  if (!expense) {
    return NextResponse.json({ error: 'Expense not found' }, { status: 404 })
  }

  // Delete the payment record
  await db
    .delete(paymentRecords)
    .where(and(
      eq(paymentRecords.expenseId, expenseId),
      eq(paymentRecords.year, year),
      eq(paymentRecords.month, month),
    ))

  return NextResponse.json({ success: true })
}
```

**Step 2: Verify**

Test with curl:
```bash
curl -X DELETE http://localhost:3000/api/expenses/EXPENSE_ID/payments \
  -H "Content-Type: application/json" \
  -H "Cookie: userId=YOUR_USER_ID" \
  -d '{"year": 2026, "month": 2}'
```

Expected: `200` with `{ "success": true }`.

**Step 3: Commit**

```bash
git add expense-tracker/src/app/api/expenses/\[id\]/payments/route.ts
git commit -m "feat(api): add DELETE /api/expenses/:id/payments to unmark"
```

---

### Task 4: Dashboard query — compute due payments

**Files:**
- Modify: `expense-tracker/src/lib/queries/dashboard.ts`

**Step 1: Add paymentRecords import and due payments computation**

Add to imports:
```typescript
import { recurringExpenses, people, paymentRecords } from '@/db/schema'
import { eq, and, inArray } from 'drizzle-orm'
```

Add the following helper function BEFORE `getDashboardData`:

```typescript
interface DuePayment {
  expenseId: string
  name: string
  amount: string
  dueDay: number
  paymentMethod: string
  year: number
  month: number
  isOverdue: boolean
  daysUntilDue: number
  recurrence: 'monthly' | 'yearly'
}

function computeDuePayments(
  activeExpenses: typeof recurringExpenses.$inferSelect[],
  paidRecords: typeof paymentRecords.$inferSelect[],
  now: Date
): { unpaid: DuePayment[]; paid: DuePayment[] } {
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  const currentDay = now.getDate()

  // Index paid records for fast lookup
  const paidSet = new Set(
    paidRecords.map((r) => `${r.expenseId}-${r.year}-${r.month}`)
  )

  const unpaid: DuePayment[] = []
  const paid: DuePayment[] = []

  for (const expense of activeExpenses) {
    const startDate = new Date(expense.startDate)
    const startYear = startDate.getFullYear()
    const startMonth = startDate.getMonth() + 1

    const endDate = expense.endDate ? new Date(expense.endDate) : null
    const endYear = endDate ? endDate.getFullYear() : currentYear
    const endMonth = endDate ? endDate.getMonth() + 1 : currentMonth

    // Cap at current month
    const lastYear = Math.min(endYear, currentYear)
    const lastMonth = lastYear < currentYear ? endMonth : Math.min(endMonth, currentMonth)

    // Iterate through eligible months
    for (let y = startYear; y <= lastYear; y++) {
      const mStart = y === startYear ? startMonth : 1
      const mEnd = y === lastYear ? lastMonth : 12

      for (let m = mStart; m <= mEnd; m++) {
        // Yearly expenses only apply in their dueMonth
        if (expense.recurrence === 'yearly' && m !== expense.dueMonth) {
          continue
        }

        const key = `${expense.id}-${y}-${m}`
        const isPaid = paidSet.has(key)

        // Calculate days until due for this specific month
        let daysUntilDue: number
        if (y < currentYear || (y === currentYear && m < currentMonth)) {
          // Past month — overdue by distance
          const dueDate = new Date(y, m - 1, expense.dueDay)
          daysUntilDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)) * -1
        } else {
          // Current month
          daysUntilDue = expense.dueDay - currentDay
        }

        const isOverdue = daysUntilDue < 0

        const payment: DuePayment = {
          expenseId: expense.id,
          name: expense.name,
          amount: expense.amount,
          dueDay: expense.dueDay,
          paymentMethod: expense.paymentMethod,
          year: y,
          month: m,
          isOverdue,
          daysUntilDue,
          recurrence: expense.recurrence,
        }

        if (isPaid) {
          paid.push(payment)
        } else {
          unpaid.push(payment)
        }
      }
    }
  }

  // Sort unpaid: most overdue first → (year, month, dueDay) ascending
  unpaid.sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if (a.month !== b.month) return a.month - b.month
    return a.dueDay - b.dueDay
  })

  // Sort paid: most recent first
  paid.sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year
    if (a.month !== b.month) return b.month - a.month
    return b.dueDay - a.dueDay
  })

  return { unpaid, paid }
}
```

**Step 2: Integrate into `getDashboardData`**

After fetching `activeExpenses` (around line 17), add:

```typescript
  // Fetch payment records for active expenses
  const expenseIds = activeExpenses.map((e) => e.id)
  const paidRecords = expenseIds.length > 0
    ? await db
        .select()
        .from(paymentRecords)
        .where(inArray(paymentRecords.expenseId, expenseIds))
    : []

  const { unpaid: duePayments, paid: paidPayments } = computeDuePayments(activeExpenses, paidRecords, now)
```

Add to the return object (alongside the existing `upcoming` property):

```typescript
      duePayments,
      paidPayments,
```

**Step 3: Remove the old `upcoming` computation**

Delete the `upcomingMonthly` and `upcomingYearly` filter blocks (lines 31-39 approx) and the `upcoming` property from the return object. The new `duePayments` replaces this.

Update the return to remove `upcoming` and add `duePayments` + `paidPayments`:

```typescript
  return {
    expenses: {
      monthly: { total: monthlyTotal, count: monthlyExpenses.length },
      yearly: { total: yearlyTotal, count: yearlyExpenses.length, asMonthly: yearlyTotal / 12 },
      effectiveMonthly: monthlyTotal + yearlyTotal / 12,
      duePayments,
      paidPayments,
    },
    loans: { /* unchanged */ },
  }
```

**Step 4: Export the `DuePayment` type**

Add at the top of the file, after the function:
```typescript
export type { DuePayment }
```

**Step 5: Commit**

```bash
git add expense-tracker/src/lib/queries/dashboard.ts
git commit -m "feat(dashboard): compute due/paid payments with urgency sorting"
```

---

### Task 5: DuePayments UI component

**Files:**
- Create: `expense-tracker/src/components/dashboard/due-payments.tsx`

**Step 1: Create the component**

```typescript
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, paymentMethodLabels } from '@/lib/formatters'
import type { DuePayment } from '@/lib/queries/dashboard'

interface DuePaymentsProps {
  unpaid: DuePayment[]
  paid: DuePayment[]
}

const paymentMethodIcons: Record<string, string> = {
  pix: '\u{1F4F1}',
  credit_card: '\u{1F4B3}',
  debit_card: '\u{1F4B3}',
  boleto: '\u{1F4C4}',
  automatic_debit: '\u{1F3E6}',
  bank_transfer: '\u{1F3E6}',
  cash: '\u{1F4B5}',
  other: '\u{1F4B0}',
}

const monthNames = [
  '', 'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function groupByMonth(payments: DuePayment[]): Map<string, DuePayment[]> {
  const groups = new Map<string, DuePayment[]>()
  for (const p of payments) {
    const key = `${p.year}-${p.month}`
    const group = groups.get(key) ?? []
    group.push(p)
    groups.set(key, group)
  }
  return groups
}

export function DuePayments({ unpaid, paid }: DuePaymentsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [optimisticPaid, setOptimisticPaid] = useState<Set<string>>(new Set())
  const [optimisticUnpaid, setOptimisticUnpaid] = useState<Set<string>>(new Set())
  const [showPaid, setShowPaid] = useState(false)
  const [confirmUnmark, setConfirmUnmark] = useState<DuePayment | null>(null)

  const paymentKey = (p: DuePayment) => `${p.expenseId}-${p.year}-${p.month}`

  // Apply optimistic updates
  const effectiveUnpaid = [
    ...unpaid.filter((p) => !optimisticPaid.has(paymentKey(p))),
    ...paid.filter((p) => optimisticUnpaid.has(paymentKey(p))),
  ].sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year
    if (a.month !== b.month) return a.month - b.month
    return a.dueDay - b.dueDay
  })

  const effectivePaid = [
    ...paid.filter((p) => !optimisticUnpaid.has(paymentKey(p))),
    ...unpaid.filter((p) => optimisticPaid.has(paymentKey(p))),
  ]

  async function markAsPaid(payment: DuePayment) {
    const key = paymentKey(payment)
    setOptimisticPaid((prev) => new Set(prev).add(key))

    try {
      const res = await fetch(`/api/expenses/${payment.expenseId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: payment.year, month: payment.month }),
      })

      if (!res.ok) {
        // Revert optimistic update
        setOptimisticPaid((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
        return
      }
    } catch {
      setOptimisticPaid((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  async function unmarkPayment(payment: DuePayment) {
    setConfirmUnmark(null)

    const key = paymentKey(payment)
    setOptimisticUnpaid((prev) => new Set(prev).add(key))

    try {
      const res = await fetch(`/api/expenses/${payment.expenseId}/payments`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: payment.year, month: payment.month }),
      })

      if (!res.ok) {
        setOptimisticUnpaid((prev) => {
          const next = new Set(prev)
          next.delete(key)
          return next
        })
        return
      }
    } catch {
      setOptimisticUnpaid((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
      return
    }

    startTransition(() => {
      router.refresh()
    })
  }

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const hasAny = effectiveUnpaid.length > 0 || effectivePaid.length > 0

  if (!hasAny) {
    return null
  }

  const unpaidGroups = groupByMonth(effectiveUnpaid)

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Pagamentos Pendentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from(unpaidGroups.entries()).map(([monthKey, payments]) => {
            const [yearStr, monthStr] = monthKey.split('-')
            const year = parseInt(yearStr)
            const month = parseInt(monthStr)
            const isCurrentMonth = year === currentYear && month === currentMonth
            const isOverdue = year < currentYear || (year === currentYear && month < currentMonth)

            let label: string
            if (isOverdue) {
              label = `Atrasado \u2014 ${monthNames[month]} ${year}`
            } else if (isCurrentMonth) {
              label = `Este mes \u2014 ${monthNames[month]} ${year}`
            } else {
              label = `${monthNames[month]} ${year}`
            }

            return (
              <div key={monthKey} className="space-y-2">
                <div className="flex items-center gap-2">
                  {isOverdue && (
                    <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
                  )}
                  <h3 className={`text-sm font-semibold uppercase tracking-wide ${
                    isOverdue ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'
                  }`}>
                    {label}
                  </h3>
                </div>

                {payments.map((payment) => {
                  const key = paymentKey(payment)
                  const isBeingPaid = optimisticPaid.has(key)

                  return (
                    <div
                      key={key}
                      className={`flex items-center justify-between p-3 rounded-lg transition-all duration-300 ${
                        isBeingPaid
                          ? 'bg-green-50 dark:bg-green-950 opacity-60'
                          : isOverdue
                            ? 'bg-red-50 dark:bg-red-950 border-l-4 border-red-400'
                            : 'bg-muted'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => markAsPaid(payment)}
                          disabled={isBeingPaid}
                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            isBeingPaid
                              ? 'border-green-500 bg-green-500 text-white scale-110'
                              : 'border-muted-foreground/40 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-950'
                          }`}
                          aria-label={`Marcar ${payment.name} como pago`}
                        >
                          {isBeingPaid && (
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-lg">{paymentMethodIcons[payment.paymentMethod]}</span>
                        <div>
                          <p className={`font-medium ${isBeingPaid ? 'line-through text-muted-foreground' : ''}`}>
                            {payment.name}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Dia {payment.dueDay} {'\u2022'} {paymentMethodLabels[payment.paymentMethod]}
                            {payment.recurrence === 'yearly' && ' (anual)'}
                          </p>
                        </div>
                      </div>
                      <span className={`font-bold ${isBeingPaid ? 'text-muted-foreground line-through' : ''}`}>
                        {formatCurrency(payment.amount)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {/* Paid section */}
          {effectivePaid.length > 0 && (
            <div className="pt-2 border-t">
              <button
                onClick={() => setShowPaid(!showPaid)}
                className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
              >
                <span className="font-medium">
                  Pagos ({effectivePaid.length})
                </span>
                <svg
                  className={`w-4 h-4 transition-transform duration-200 ${showPaid ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showPaid && (
                <div className="space-y-2 mt-2">
                  {effectivePaid.map((payment) => {
                    const key = paymentKey(payment)
                    return (
                      <div
                        key={key}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 opacity-70"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => setConfirmUnmark(payment)}
                            className="w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 text-white flex items-center justify-center hover:bg-green-600 transition-colors"
                            aria-label={`Desmarcar ${payment.name}`}
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <span className="text-lg">{paymentMethodIcons[payment.paymentMethod]}</span>
                          <div>
                            <p className="font-medium line-through text-muted-foreground">
                              {payment.name}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {monthNames[payment.month]} {payment.year} {'\u2022'} Dia {payment.dueDay}
                            </p>
                          </div>
                        </div>
                        <span className="font-bold text-muted-foreground line-through">
                          {formatCurrency(payment.amount)}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog for unmarking */}
      <Dialog open={confirmUnmark !== null} onOpenChange={(open) => !open && setConfirmUnmark(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Desmarcar pagamento?</DialogTitle>
            <DialogDescription>
              {confirmUnmark && (
                <>
                  Deseja desmarcar o pagamento de{' '}
                  <strong>{confirmUnmark.name}</strong> em{' '}
                  <strong>{monthNames[confirmUnmark.month]} {confirmUnmark.year}</strong>?
                  Isso vai mover o pagamento de volta para a lista de pendentes.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUnmark(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmUnmark && unmarkPayment(confirmUnmark)}
            >
              Desmarcar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
```

**Step 2: Commit**

```bash
git add expense-tracker/src/components/dashboard/due-payments.tsx
git commit -m "feat(ui): add DuePayments component with mark/unmark interactions"
```

---

### Task 6: Wire up dashboard page

**Files:**
- Modify: `expense-tracker/src/app/page.tsx`

**Step 1: Replace UpcomingPayments with DuePayments**

Replace the full file content:

```typescript
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ExpensesSummary } from '@/components/dashboard/expenses-summary'
import { LoansSummary } from '@/components/dashboard/loans-summary'
import { DuePayments } from '@/components/dashboard/due-payments'
import { getDashboardData } from '@/lib/queries/dashboard'

export default async function DashboardPage() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  if (!userId) {
    redirect('/login')
  }

  const data = await getDashboardData(userId)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <ExpensesSummary
          monthly={data.expenses.monthly}
          yearly={data.expenses.yearly}
          effectiveMonthly={data.expenses.effectiveMonthly}
        />
        <LoansSummary
          theyOweMe={data.loans.theyOweMe}
          iOweThem={data.loans.iOweThem}
          netBalance={data.loans.netBalance}
          transactionCount={data.loans.transactionCount}
          peopleWithBalance={data.loans.peopleWithBalance}
        />
      </div>

      <DuePayments
        unpaid={data.expenses.duePayments}
        paid={data.expenses.paidPayments}
      />
    </div>
  )
}
```

**Step 2: Verify the dashboard renders**

Run: `pnpm dev` and visit `http://localhost:3000`.

Expected:
- Dashboard loads without errors
- "Pagamentos Pendentes" card shows unpaid expenses grouped by month
- Overdue items have red styling
- Clicking checkbox marks as paid with animation
- "Pagos" section shows paid items
- Clicking paid checkbox shows confirmation dialog

**Step 3: Commit**

```bash
git add expense-tracker/src/app/page.tsx
git commit -m "feat(dashboard): replace UpcomingPayments with DuePayments"
```

---

### Task 7: Update expense form — make dueDay required

**Files:**
- Modify: `expense-tracker/src/components/expenses/expense-form.tsx`

**Step 1: Make dueDay required in the form**

In the form JSX, change the dueDay input from optional to required:

Find:
```typescript
              <Label htmlFor="dueDay">Dia de Vencimento</Label>
```

Change to:
```typescript
              <Label htmlFor="dueDay">Dia de Vencimento *</Label>
```

Add `required` to the dueDay Input:
```typescript
              <Input
                id="dueDay"
                type="number"
                min="1"
                max="31"
                value={formData.dueDay}
                onChange={(e) => setFormData({ ...formData, dueDay: e.target.value })}
                placeholder="1-31"
                required
              />
```

**Step 2: Update the payload to always send dueDay as a number**

In the `handleSubmit` function, change:
```typescript
        dueDay: formData.dueDay ? parseInt(formData.dueDay) : null,
```
to:
```typescript
        dueDay: parseInt(formData.dueDay),
```

**Step 3: Commit**

```bash
git add expense-tracker/src/components/expenses/expense-form.tsx
git commit -m "feat(form): make dueDay required in expense form"
```

---

### Task 8: Clean up — remove unused UpcomingPayments component

**Files:**
- Delete: `expense-tracker/src/components/dashboard/upcoming-payments.tsx`

**Step 1: Verify no other imports reference it**

Search for `upcoming-payments` or `UpcomingPayments` across the codebase. After Task 6, only the old import in `page.tsx` used it (now replaced).

**Step 2: Delete the file**

```bash
rm expense-tracker/src/components/dashboard/upcoming-payments.tsx
```

**Step 3: Build check**

Run: `cd /Users/alpsilva/projects/expense-tracker/expense-tracker && pnpm build`

Expected: Build succeeds without errors.

**Step 4: Commit**

```bash
git add expense-tracker/src/components/dashboard/upcoming-payments.tsx
git commit -m "chore: remove unused UpcomingPayments component"
```

---

### Task 9: Final verification

**Step 1: Run lint**

```bash
cd /Users/alpsilva/projects/expense-tracker/expense-tracker && pnpm lint
```

Fix any lint errors.

**Step 2: Run build**

```bash
cd /Users/alpsilva/projects/expense-tracker/expense-tracker && pnpm build
```

Verify build passes.

**Step 3: Manual smoke test**

1. Visit dashboard — verify "Pagamentos Pendentes" shows current + overdue months
2. Click a checkbox — verify animation and item moves to "Pagos"
3. Expand "Pagos" — verify paid items show with checked circles
4. Click a paid item's circle — verify confirmation dialog appears
5. Confirm unmark — verify item moves back to unpaid list
6. Create a new expense — verify dueDay is now required

**Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: address lint and build issues"
```
