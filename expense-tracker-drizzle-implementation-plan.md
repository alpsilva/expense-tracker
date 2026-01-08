# Expense Tracker Implementation Plan (Drizzle Version)

A personal expense tracking application with two core features:
1. **Recurring Expenses** — Track monthly/yearly subscriptions and fixed costs with payment methods and due dates
2. **Lending Tracker** — Track money lent to/borrowed from people, with bidirectional balances

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** Neon (Serverless PostgreSQL)
- **ORM:** Drizzle ORM
- **Hosting:** Vercel (free tier)
- **UI:** shadcn/ui + Tailwind CSS

---

## Part 1: Environment Setup

### 1.1 Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up"
3. Choose "Continue with GitHub" (recommended) or email
4. If using GitHub, authorize Vercel to access your repositories
5. Complete profile setup (hobby/personal project tier is free)

### 1.2 Create Neon Database

1. Go to [neon.tech](https://neon.tech)
2. Click "Sign Up" → use GitHub SSO (same account as Vercel for simplicity)
3. Create a new project:
   - **Name:** `expense-tracker`
   - **Region:** Choose closest to you (e.g., `sa-east-1` for Brazil)
   - **Postgres version:** Latest (16+)
4. Once created, copy the connection string:
   - Click "Connection Details"
   - Copy the connection string (looks like `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`)

### 1.3 Local Development Setup

```bash
# Create Next.js project
npx create-next-app@latest expense-tracker --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

cd expense-tracker

# Install Drizzle dependencies
npm install drizzle-orm @neondatabase/serverless
npm install -D drizzle-kit

# Install other utilities
npm install zod
```

### 1.4 Configure Environment Variables

Create `.env.local` file:

```env
DATABASE_URL="postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require"
```

Add to `.gitignore`:
```
.env
.env.local
```

---

## Part 2: Database Schema

### 2.1 Drizzle Configuration

Create `drizzle.config.ts` at project root:

```typescript
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

### 2.2 Database Connection

Create `src/db/index.ts`:

```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const sql = neon(process.env.DATABASE_URL!)

export const db = drizzle(sql, { schema })
```

### 2.3 Schema Definition

Create `src/db/schema.ts`:

```typescript
import {
  pgTable,
  text,
  timestamp,
  decimal,
  boolean,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { createId } from '@paralleldrive/cuid2'

// ============================================
// ENUMS
// ============================================

export const recurrenceTypeEnum = pgEnum('recurrence_type', [
  'monthly',
  'yearly',
])

export const expenseCategoryEnum = pgEnum('expense_category', [
  'subscription',   // Netflix, Spotify, etc.
  'utility',        // Electricity, water, internet
  'insurance',      // Health, car, home
  'rent',           // Housing
  'loan_payment',   // Car payment, mortgage
  'membership',     // Gym, clubs
  'education',      // Courses, school
  'transport',      // Car maintenance, fuel
  'other',
])

export const paymentMethodEnum = pgEnum('payment_method', [
  'pix',
  'credit_card',
  'debit_card',
  'boleto',
  'automatic_debit', // Débito automático
  'bank_transfer',
  'cash',
  'other',
])

// Direction: who owes whom
export const transactionDirectionEnum = pgEnum('transaction_direction', [
  'lent',      // I lent money TO this person (they owe me)
  'borrowed',  // I borrowed money FROM this person (I owe them)
])

// ============================================
// RECURRING EXPENSES
// ============================================

export const recurringExpenses = pgTable('recurring_expenses', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  
  // Basic info
  name: text('name').notNull(),
  description: text('description'),
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('BRL').notNull(),
  
  // Categorization
  category: expenseCategoryEnum('category').default('other').notNull(),
  recurrence: recurrenceTypeEnum('recurrence').notNull(),
  
  // Payment details
  paymentMethod: paymentMethodEnum('payment_method').notNull(),
  
  // Due date info
  dueDay: integer('due_day'),           // Day of month (1-31) when payment is due
  dueMonth: integer('due_month'),       // Month (1-12) for yearly expenses
  
  // Lifecycle
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  isActive: boolean('is_active').default(true).notNull(),
  
  // Extra info
  notes: text('notes'),
  url: text('url'),                     // Link to service/bill management
  
  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================
// PEOPLE (for lending)
// ============================================

export const people = pgTable('people', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  
  name: text('name').notNull(),
  nickname: text('nickname'),           // How you refer to them
  email: text('email'),
  phone: text('phone'),
  relationship: text('relationship'),   // "college friend", "cousin", "coworker"
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================
// LOANS (bidirectional)
// ============================================

export const loans = pgTable('loans', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  
  personId: text('person_id').notNull().references(() => people.id, { onDelete: 'cascade' }),
  
  // Direction: did I lend or borrow?
  direction: transactionDirectionEnum('direction').notNull(),
  
  // Loan details
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  currency: text('currency').default('BRL').notNull(),
  reason: text('reason').notNull(),     // Why the loan happened
  
  // Dates
  transactionDate: timestamp('transaction_date', { withTimezone: true }).notNull(),
  expectedSettlement: timestamp('expected_settlement', { withTimezone: true }),
  
  // Status
  isSettled: boolean('is_settled').default(false).notNull(),
  
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================
// LOAN PAYMENTS
// ============================================

export const loanPayments = pgTable('loan_payments', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  
  loanId: text('loan_id').notNull().references(() => loans.id, { onDelete: 'cascade' }),
  
  amount: decimal('amount', { precision: 10, scale: 2 }).notNull(),
  paidAt: timestamp('paid_at', { withTimezone: true }).notNull(),
  method: paymentMethodEnum('method'),
  notes: text('notes'),
  
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ============================================
// RELATIONS
// ============================================

export const peopleRelations = relations(people, ({ many }) => ({
  loans: many(loans),
}))

export const loansRelations = relations(loans, ({ one, many }) => ({
  person: one(people, {
    fields: [loans.personId],
    references: [people.id],
  }),
  payments: many(loanPayments),
}))

export const loanPaymentsRelations = relations(loanPayments, ({ one }) => ({
  loan: one(loans, {
    fields: [loanPayments.loanId],
    references: [loans.id],
  }),
}))

// ============================================
// TYPE EXPORTS
// ============================================

export type RecurringExpense = typeof recurringExpenses.$inferSelect
export type NewRecurringExpense = typeof recurringExpenses.$inferInsert

export type Person = typeof people.$inferSelect
export type NewPerson = typeof people.$inferInsert

export type Loan = typeof loans.$inferSelect
export type NewLoan = typeof loans.$inferInsert

export type LoanPayment = typeof loanPayments.$inferSelect
export type NewLoanPayment = typeof loanPayments.$inferInsert
```

### 2.4 Install CUID2 for IDs

```bash
npm install @paralleldrive/cuid2
```

### 2.5 Run Migration

```bash
# Generate migration
npx drizzle-kit generate

# Push to database (for development) or apply migration
npx drizzle-kit push
```

---

## Part 3: Project Structure

```
expense-tracker/
├── drizzle/                            # Generated migrations
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                    # Dashboard
│   │   ├── expenses/
│   │   │   ├── page.tsx                # List recurring expenses (segmented)
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── loans/
│   │   │   ├── page.tsx                # Overview of all balances
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── people/
│   │   │   ├── page.tsx                # List people with balances
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/page.tsx           # Person detail with all loans
│   │   └── api/
│   │       ├── expenses/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── loans/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── payments/route.ts
│   │       ├── people/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── balance/route.ts
│   │       └── dashboard/route.ts
│   ├── components/
│   │   ├── ui/                         # shadcn components
│   │   ├── expenses/
│   │   │   ├── expense-form.tsx
│   │   │   ├── expense-card.tsx
│   │   │   ├── monthly-expenses-section.tsx
│   │   │   └── yearly-expenses-section.tsx
│   │   ├── loans/
│   │   │   ├── loan-form.tsx
│   │   │   ├── loan-card.tsx
│   │   │   └── payment-form.tsx
│   │   ├── people/
│   │   │   ├── person-card.tsx
│   │   │   ├── person-balance.tsx
│   │   │   └── person-loans-list.tsx
│   │   └── dashboard/
│   │       ├── expenses-summary.tsx
│   │       ├── loans-summary.tsx
│   │       └── upcoming-payments.tsx
│   ├── db/
│   │   ├── index.ts                    # Drizzle client
│   │   └── schema.ts                   # Schema definitions
│   ├── lib/
│   │   ├── utils.ts
│   │   └── formatters.ts
│   └── types/
│       └── index.ts
├── drizzle.config.ts
├── .env.local
└── package.json
```

---

## Part 4: Core Implementation

### 4.1 Utility Functions

Create `src/lib/formatters.ts`:

```typescript
export function formatCurrency(
  amount: number | string,
  currency: string = 'BRL'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR').format(d)
}

export function formatDueDate(day: number, month?: number): string {
  if (month) {
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
      new Date(2024, month - 1)
    )
    return `Dia ${day} de ${monthName}`
  }
  return `Todo dia ${day}`
}

export const paymentMethodLabels: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  boleto: 'Boleto',
  automatic_debit: 'Débito Automático',
  bank_transfer: 'Transferência',
  cash: 'Dinheiro',
  other: 'Outro',
}

export const categoryLabels: Record<string, string> = {
  subscription: 'Assinatura',
  utility: 'Utilidade',
  insurance: 'Seguro',
  rent: 'Aluguel',
  loan_payment: 'Financiamento',
  membership: 'Mensalidade',
  education: 'Educação',
  transport: 'Transporte',
  other: 'Outro',
}
```

### 4.2 API Routes

#### Recurring Expenses API

`src/app/api/expenses/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// GET /api/expenses - List all expenses, segmented by recurrence
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const activeOnly = searchParams.get('active') === 'true'
  const recurrence = searchParams.get('recurrence') as 'monthly' | 'yearly' | null

  const conditions = []
  if (activeOnly) conditions.push(eq(recurringExpenses.isActive, true))
  if (recurrence) conditions.push(eq(recurringExpenses.recurrence, recurrence))

  const expenses = await db
    .select()
    .from(recurringExpenses)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(recurringExpenses.dueDay, desc(recurringExpenses.createdAt))

  // Group by recurrence type
  const monthly = expenses.filter((e) => e.recurrence === 'monthly')
  const yearly = expenses.filter((e) => e.recurrence === 'yearly')

  // Calculate totals
  const monthlyTotal = monthly.reduce((sum, e) => sum + parseFloat(e.amount), 0)
  const yearlyTotal = yearly.reduce((sum, e) => sum + parseFloat(e.amount), 0)

  return NextResponse.json({
    expenses: {
      monthly,
      yearly,
    },
    totals: {
      monthly: monthlyTotal,
      yearly: yearlyTotal,
      yearlyAsMonthly: yearlyTotal / 12,
      effectiveMonthly: monthlyTotal + yearlyTotal / 12,
    },
  })
}

// POST /api/expenses - Create new expense
export async function POST(request: NextRequest) {
  const body = await request.json()

  const [expense] = await db
    .insert(recurringExpenses)
    .values({
      name: body.name,
      description: body.description,
      amount: body.amount.toString(),
      currency: body.currency || 'BRL',
      category: body.category || 'other',
      recurrence: body.recurrence,
      paymentMethod: body.paymentMethod,
      dueDay: body.dueDay,
      dueMonth: body.dueMonth,
      startDate: new Date(body.startDate),
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes,
      url: body.url,
      isActive: body.isActive ?? true,
    })
    .returning()

  return NextResponse.json(expense, { status: 201 })
}
```

`src/app/api/expenses/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses } from '@/db/schema'
import { eq } from 'drizzle-orm'

// GET /api/expenses/:id
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const [expense] = await db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.id, params.id))
    .limit(1)

  if (!expense) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(expense)
}

// PUT /api/expenses/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  const [expense] = await db
    .update(recurringExpenses)
    .set({
      name: body.name,
      description: body.description,
      amount: body.amount?.toString(),
      currency: body.currency,
      category: body.category,
      recurrence: body.recurrence,
      paymentMethod: body.paymentMethod,
      dueDay: body.dueDay,
      dueMonth: body.dueMonth,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : null,
      notes: body.notes,
      url: body.url,
      isActive: body.isActive,
      updatedAt: new Date(),
    })
    .where(eq(recurringExpenses.id, params.id))
    .returning()

  return NextResponse.json(expense)
}

// DELETE /api/expenses/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db
    .delete(recurringExpenses)
    .where(eq(recurringExpenses.id, params.id))

  return NextResponse.json({ success: true })
}
```

#### People API with Balance Calculation

`src/app/api/people/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people, loans, loanPayments } from '@/db/schema'
import { eq, sql, desc } from 'drizzle-orm'

// GET /api/people - List all people with their balances
export async function GET() {
  // Get all people with their loans and payments
  const allPeople = await db.query.people.findMany({
    with: {
      loans: {
        with: {
          payments: true,
        },
      },
    },
    orderBy: [desc(people.updatedAt)],
  })

  // Calculate balance for each person
  const peopleWithBalances = allPeople.map((person) => {
    let balance = 0 // Positive = they owe me, Negative = I owe them

    for (const loan of person.loans) {
      const loanAmount = parseFloat(loan.amount)
      const totalPaid = loan.payments.reduce(
        (sum, p) => sum + parseFloat(p.amount),
        0
      )
      const remaining = loanAmount - totalPaid

      if (loan.direction === 'lent') {
        // I lent money, they owe me
        balance += remaining
      } else {
        // I borrowed money, I owe them
        balance -= remaining
      }
    }

    const activeLoans = person.loans.filter((l) => !l.isSettled)

    return {
      ...person,
      balance,
      balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
      activeLoansCount: activeLoans.length,
      loans: undefined, // Don't send all loan details in list
    }
  })

  // Sort by absolute balance (biggest debts first)
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
  const body = await request.json()

  const [person] = await db
    .insert(people)
    .values({
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

`src/app/api/people/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { people, loans, loanPayments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

// GET /api/people/:id - Get person with all loans and computed balance
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const person = await db.query.people.findFirst({
    where: eq(people.id, params.id),
    with: {
      loans: {
        with: {
          payments: {
            orderBy: [desc(loanPayments.paidAt)],
          },
        },
        orderBy: [desc(loans.transactionDate)],
      },
    },
  })

  if (!person) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Calculate balance and enrich loans
  let balance = 0
  const enrichedLoans = person.loans.map((loan) => {
    const loanAmount = parseFloat(loan.amount)
    const totalPaid = loan.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )
    const remaining = loanAmount - totalPaid

    if (loan.direction === 'lent') {
      balance += remaining
    } else {
      balance -= remaining
    }

    return {
      ...loan,
      totalPaid,
      remaining,
    }
  })

  return NextResponse.json({
    ...person,
    loans: enrichedLoans,
    balance,
    balanceDirection: balance > 0 ? 'they_owe_me' : balance < 0 ? 'i_owe_them' : 'settled',
  })
}

// PUT /api/people/:id
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    .where(eq(people.id, params.id))
    .returning()

  return NextResponse.json(person)
}

// DELETE /api/people/:id
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  await db.delete(people).where(eq(people.id, params.id))
  return NextResponse.json({ success: true })
}
```

#### Loans API

`src/app/api/loans/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { loans, people, loanPayments } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'

// GET /api/loans - List all loans
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const activeOnly = searchParams.get('active') === 'true'
  const personId = searchParams.get('personId')
  const direction = searchParams.get('direction') as 'lent' | 'borrowed' | null

  const allLoans = await db.query.loans.findMany({
    where: and(
      activeOnly ? eq(loans.isSettled, false) : undefined,
      personId ? eq(loans.personId, personId) : undefined,
      direction ? eq(loans.direction, direction) : undefined
    ),
    with: {
      person: true,
      payments: {
        orderBy: [desc(loanPayments.paidAt)],
      },
    },
    orderBy: [desc(loans.transactionDate)],
  })

  // Enrich with computed fields
  const enrichedLoans = allLoans.map((loan) => {
    const totalPaid = loan.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )
    return {
      ...loan,
      totalPaid,
      remaining: parseFloat(loan.amount) - totalPaid,
    }
  })

  return NextResponse.json(enrichedLoans)
}

// POST /api/loans - Create new loan
export async function POST(request: NextRequest) {
  const body = await request.json()

  // Create person inline if needed
  let personId = body.personId

  if (!personId && body.personName) {
    const [person] = await db
      .insert(people)
      .values({
        name: body.personName,
        nickname: body.personNickname,
        email: body.personEmail,
        phone: body.personPhone,
        relationship: body.personRelationship,
      })
      .returning()
    personId = person.id
  }

  const [loan] = await db
    .insert(loans)
    .values({
      personId,
      direction: body.direction,
      amount: body.amount.toString(),
      currency: body.currency || 'BRL',
      reason: body.reason,
      transactionDate: new Date(body.transactionDate),
      expectedSettlement: body.expectedSettlement
        ? new Date(body.expectedSettlement)
        : null,
      notes: body.notes,
    })
    .returning()

  // Fetch with person
  const enrichedLoan = await db.query.loans.findFirst({
    where: eq(loans.id, loan.id),
    with: { person: true },
  })

  return NextResponse.json(enrichedLoan, { status: 201 })
}
```

`src/app/api/loans/[id]/payments/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { loans, loanPayments } from '@/db/schema'
import { eq, desc } from 'drizzle-orm'

// GET /api/loans/:id/payments - List payments for a loan
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const payments = await db
    .select()
    .from(loanPayments)
    .where(eq(loanPayments.loanId, params.id))
    .orderBy(desc(loanPayments.paidAt))

  return NextResponse.json(payments)
}

// POST /api/loans/:id/payments - Record a payment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await request.json()

  // Create the payment
  const [payment] = await db
    .insert(loanPayments)
    .values({
      loanId: params.id,
      amount: body.amount.toString(),
      paidAt: new Date(body.paidAt),
      method: body.method,
      notes: body.notes,
    })
    .returning()

  // Check if loan is now fully paid
  const loan = await db.query.loans.findFirst({
    where: eq(loans.id, params.id),
    with: { payments: true },
  })

  if (loan) {
    const totalPaid = loan.payments.reduce(
      (sum, p) => sum + parseFloat(p.amount),
      0
    )

    if (totalPaid >= parseFloat(loan.amount)) {
      await db
        .update(loans)
        .set({ isSettled: true, updatedAt: new Date() })
        .where(eq(loans.id, params.id))
    }
  }

  return NextResponse.json(payment, { status: 201 })
}
```

### 4.3 Dashboard API

`src/app/api/dashboard/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { db } from '@/db'
import { recurringExpenses, people, loans, loanPayments } from '@/db/schema'
import { eq, and, gte, lte, desc } from 'drizzle-orm'

export async function GET() {
  const now = new Date()
  const currentDay = now.getDate()
  const currentMonth = now.getMonth() + 1

  // ============================================
  // RECURRING EXPENSES
  // ============================================
  const activeExpenses = await db
    .select()
    .from(recurringExpenses)
    .where(eq(recurringExpenses.isActive, true))

  const monthlyExpenses = activeExpenses.filter((e) => e.recurrence === 'monthly')
  const yearlyExpenses = activeExpenses.filter((e) => e.recurrence === 'yearly')

  const monthlyTotal = monthlyExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0
  )
  const yearlyTotal = yearlyExpenses.reduce(
    (sum, e) => sum + parseFloat(e.amount),
    0
  )

  // Upcoming payments (next 7 days for monthly, this month for yearly)
  const upcomingMonthly = monthlyExpenses.filter((e) => {
    if (!e.dueDay) return false
    const daysUntilDue = e.dueDay - currentDay
    return daysUntilDue >= 0 && daysUntilDue <= 7
  })

  const upcomingYearly = yearlyExpenses.filter((e) => {
    return e.dueMonth === currentMonth
  })

  // ============================================
  // LOANS
  // ============================================
  const allPeople = await db.query.people.findMany({
    with: {
      loans: {
        where: eq(loans.isSettled, false),
        with: { payments: true },
      },
    },
  })

  let totalTheyOweMe = 0
  let totalIOweThem = 0

  for (const person of allPeople) {
    for (const loan of person.loans) {
      const remaining =
        parseFloat(loan.amount) -
        loan.payments.reduce((sum, p) => sum + parseFloat(p.amount), 0)

      if (loan.direction === 'lent') {
        totalTheyOweMe += remaining
      } else {
        totalIOweThem += remaining
      }
    }
  }

  const activeLoansCount = allPeople.reduce(
    (sum, p) => sum + p.loans.length,
    0
  )

  // ============================================
  // RESPONSE
  // ============================================
  return NextResponse.json({
    expenses: {
      monthly: {
        total: monthlyTotal,
        count: monthlyExpenses.length,
      },
      yearly: {
        total: yearlyTotal,
        count: yearlyExpenses.length,
        asMonthly: yearlyTotal / 12,
      },
      effectiveMonthly: monthlyTotal + yearlyTotal / 12,
      upcoming: {
        monthly: upcomingMonthly.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          dueDay: e.dueDay,
          paymentMethod: e.paymentMethod,
        })),
        yearly: upcomingYearly.map((e) => ({
          id: e.id,
          name: e.name,
          amount: e.amount,
          dueDay: e.dueDay,
          dueMonth: e.dueMonth,
          paymentMethod: e.paymentMethod,
        })),
      },
    },
    loans: {
      theyOweMe: totalTheyOweMe,
      iOweThem: totalIOweThem,
      netBalance: totalTheyOweMe - totalIOweThem,
      activeLoansCount,
      peopleWithActiveLoans: allPeople.filter((p) => p.loans.length > 0).length,
    },
  })
}
```

---

## Part 5: UI Components Setup

### 5.1 Install shadcn/ui

```bash
npx shadcn@latest init
```

Options:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Install components:

```bash
npx shadcn@latest add button card input label select textarea table badge dialog form tabs separator avatar
```

### 5.2 Key UI Sections to Build

#### Dashboard (`/`)

```
┌─────────────────────────────────────────────────────────────┐
│  GASTOS RECORRENTES                                         │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ R$ 2.450,00/mês  │  │ R$ 3.200,00/ano  │                │
│  │ 12 despesas      │  │ (R$ 266,67/mês)  │                │
│  └──────────────────┘  └──────────────────┘                │
│  Custo mensal efetivo: R$ 2.716,67                         │
├─────────────────────────────────────────────────────────────┤
│  PRÓXIMOS VENCIMENTOS                                       │
│  • Netflix (dia 15) - R$ 55,90 - Cartão de Crédito         │
│  • Internet (dia 20) - R$ 149,90 - Débito Automático       │
├─────────────────────────────────────────────────────────────┤
│  EMPRÉSTIMOS                                                │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ Me devem         │  │ Eu devo          │                │
│  │ R$ 1.500,00      │  │ R$ 300,00        │                │
│  │ 3 pessoas        │  │ 1 pessoa         │                │
│  └──────────────────┘  └──────────────────┘                │
│  Saldo líquido: +R$ 1.200,00                               │
└─────────────────────────────────────────────────────────────┘
```

#### Expenses Page (`/expenses`)

```
┌─────────────────────────────────────────────────────────────┐
│  DESPESAS MENSAIS                          Total: R$ 2.450 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Netflix           R$ 55,90    Dia 15   💳 Crédito      ││
│  │ Spotify           R$ 21,90    Dia 5    💳 Crédito      ││
│  │ Internet          R$ 149,90   Dia 20   🏦 Déb. Auto    ││
│  │ Academia          R$ 99,90    Dia 1    📱 Pix          ││
│  └─────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────┤
│  DESPESAS ANUAIS                           Total: R$ 3.200 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ IPVA              R$ 1.800    Jan/15   📄 Boleto       ││
│  │ Seguro Carro      R$ 1.400    Mar/10   📄 Boleto       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### People/Loans Page (`/people`)

```
┌─────────────────────────────────────────────────────────────┐
│  PESSOAS                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 👤 João (primo)                                         ││
│  │    Me deve: R$ 800,00                    [Ver detalhes] ││
│  │    2 empréstimos ativos                                 ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 👤 Maria (colega)                                       ││
│  │    Me deve: R$ 500,00                    [Ver detalhes] ││
│  │    1 empréstimo ativo                                   ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 👤 Pedro (amigo faculdade)                              ││
│  │    Eu devo: R$ 300,00                    [Ver detalhes] ││
│  │    1 empréstimo ativo                                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

#### Person Detail (`/people/[id]`)

```
┌─────────────────────────────────────────────────────────────┐
│  👤 JOÃO                                                    │
│  Primo • joao@email.com • (81) 99999-9999                  │
│                                                             │
│  SALDO: Me deve R$ 800,00                                  │
├─────────────────────────────────────────────────────────────┤
│  EMPRÉSTIMOS                                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ 🔴 Emprestei R$ 500,00 em 15/01/2024                    ││
│  │    "Conserto do carro"                                  ││
│  │    Pago: R$ 200,00 | Resta: R$ 300,00                   ││
│  │    ├── R$ 100,00 em 01/02 (Pix)                         ││
│  │    └── R$ 100,00 em 15/02 (Pix)                         ││
│  │                                         [+ Pagamento]   ││
│  ├─────────────────────────────────────────────────────────┤│
│  │ 🔴 Emprestei R$ 500,00 em 10/03/2024                    ││
│  │    "Emergência médica"                                  ││
│  │    Pago: R$ 0,00 | Resta: R$ 500,00                     ││
│  │                                         [+ Pagamento]   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Part 6: Deployment to Vercel

### 6.1 Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"

gh repo create expense-tracker --private --source=. --push
# Or manually create on GitHub and push
```

### 6.2 Deploy on Vercel

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click "Add New..." → "Project"
3. Select your `expense-tracker` repository
4. Configure:
   - **Framework Preset:** Next.js
   - **Build Command:** `npx drizzle-kit push && next build`
   - **Environment Variables:**
     - `DATABASE_URL` = your Neon connection string
5. Click "Deploy"

### 6.3 Verify Deployment

1. Visit your Vercel URL
2. Test `/api/dashboard` returns empty totals
3. Create a test expense via UI or API
4. Verify data persists

---

## Part 7: API Endpoints Reference

### Expenses

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/expenses` | List all (query: `?active=true&recurrence=monthly`) |
| POST | `/api/expenses` | Create expense |
| GET | `/api/expenses/:id` | Get single expense |
| PUT | `/api/expenses/:id` | Update expense |
| DELETE | `/api/expenses/:id` | Delete expense |

### People

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/people` | List all with balances |
| POST | `/api/people` | Create person |
| GET | `/api/people/:id` | Get person with loans & balance |
| PUT | `/api/people/:id` | Update person |
| DELETE | `/api/people/:id` | Delete person (cascades loans) |

### Loans

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/loans` | List all (query: `?active=true&personId=X&direction=lent`) |
| POST | `/api/loans` | Create loan (can create person inline) |
| GET | `/api/loans/:id` | Get loan with payments |
| PUT | `/api/loans/:id` | Update loan |
| DELETE | `/api/loans/:id` | Delete loan |
| GET | `/api/loans/:id/payments` | List payments |
| POST | `/api/loans/:id/payments` | Record payment |

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard` | Get all summary stats |

---

## Part 8: Validation Schemas (Zod)

Create `src/lib/validations.ts`:

```typescript
import { z } from 'zod'

export const expenseSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  amount: z.number().positive('Valor deve ser positivo'),
  currency: z.string().default('BRL'),
  category: z.enum([
    'subscription', 'utility', 'insurance', 'rent',
    'loan_payment', 'membership', 'education', 'transport', 'other'
  ]),
  recurrence: z.enum(['monthly', 'yearly']),
  paymentMethod: z.enum([
    'pix', 'credit_card', 'debit_card', 'boleto',
    'automatic_debit', 'bank_transfer', 'cash', 'other'
  ]),
  dueDay: z.number().min(1).max(31).optional(),
  dueMonth: z.number().min(1).max(12).optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  url: z.string().url().optional(),
  isActive: z.boolean().default(true),
})

export const personSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  nickname: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  relationship: z.string().optional(),
  notes: z.string().optional(),
})

export const loanSchema = z.object({
  personId: z.string().optional(),
  personName: z.string().optional(),
  direction: z.enum(['lent', 'borrowed']),
  amount: z.number().positive('Valor deve ser positivo'),
  currency: z.string().default('BRL'),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  transactionDate: z.string().datetime(),
  expectedSettlement: z.string().datetime().optional(),
  notes: z.string().optional(),
}).refine(
  (data) => data.personId || data.personName,
  { message: 'Pessoa é obrigatória' }
)

export const paymentSchema = z.object({
  amount: z.number().positive('Valor deve ser positivo'),
  paidAt: z.string().datetime(),
  method: z.enum([
    'pix', 'credit_card', 'debit_card', 'boleto',
    'automatic_debit', 'bank_transfer', 'cash', 'other'
  ]).optional(),
  notes: z.string().optional(),
})
```

---

## Notes for AI Implementation

When building the frontend:

1. **Server vs Client Components:**
   - Server Components: pages that just display data
   - Client Components: forms, interactive elements, anything with `onClick`

2. **Data fetching patterns:**
   - In Server Components: call `db.query.*` directly (skip API)
   - In Client Components: use `fetch('/api/...')`

3. **Brazilian formatting:**
   - Currency: `formatCurrency(1234.56)` → `R$ 1.234,56`
   - Dates: `formatDate(date)` → `07/01/2026`

4. **Color coding for balances:**
   - Green: they owe me (positive)
   - Red: I owe them (negative)
   - Gray: settled

5. **Payment method icons:**
   - 💳 Credit/Debit card
   - 📱 Pix
   - 📄 Boleto
   - 🏦 Automatic debit/Transfer
   - 💵 Cash

6. **Form handling:**
   - Use `react-hook-form` with `zodResolver`
   - shadcn Form component already integrates these
