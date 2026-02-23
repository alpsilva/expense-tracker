# Monthly Payment Tracker — Design

Track whether recurring expenses have been paid each month, with urgency-sorted display on the dashboard.

## Data Model

New `paymentRecords` table:

| Column    | Type                       | Constraints                        |
|-----------|----------------------------|------------------------------------|
| id        | text (cuid)                | PK                                 |
| expenseId | text                       | FK → recurring_expenses.id CASCADE |
| year      | integer                    | NOT NULL                           |
| month     | integer (1-12)             | NOT NULL                           |
| paidAt    | timestamp with timezone    | NOT NULL                           |
| createdAt | timestamp with timezone    | NOT NULL, default now()            |

**Unique constraint:** `(expenseId, year, month)` — one record per expense per month.

**Absence = unpaid.** No record means the payment hasn't been made. Marking as paid creates a record. Unmarking deletes it.

### Schema migration: make dueDay mandatory

- `dueDay` becomes `NOT NULL` (backfill existing nulls with `1`)
- `dueMonth` becomes `NOT NULL` for yearly expenses (backfill existing nulls with `1`)

## Computing Due Payments

Computed on page load (no background jobs, no pre-generated records).

### Which months to check

For each active recurring expense:
- **Start:** the month of the expense's `startDate`
- **End:** the current month (never future months)
- If expense has `endDate` or `isActive = false`, stop at the earlier of `endDate`'s month or current month

### Monthly vs yearly expenses

- **Monthly:** generates a due payment for every eligible month
- **Yearly:** generates a due payment only in the expense's `dueMonth` each year

### Determining paid/unpaid

Fetch all `paymentRecords` for the relevant expense IDs and month window. Cross-reference: if a record exists for (expenseId, year, month), it's paid. Otherwise, unpaid.

### Urgency sorting (all unpaid items)

Sort key: `(year, month, dueDay)` ascending. This naturally produces:

1. **Overdue past months** — oldest first
2. **Overdue this month** — due day already passed
3. **Due today**
4. **Due soon** — ascending by due day

## API

### `POST /api/expenses/[id]/payments` — Mark as paid

- **Body:** `{ year: number, month: number }`
- **Creates** a `paymentRecord` with `paidAt = now()`
- **Returns** `201` with the created record
- **Idempotent:** if record already exists, returns `200` with existing record
- **Auth:** requires `getAuthUserId()`, validates expense belongs to user

### `DELETE /api/expenses/[id]/payments` — Unmark payment

- **Body:** `{ year: number, month: number }`
- **Deletes** the matching `paymentRecord`
- **Returns** `200`
- **Auth:** requires `getAuthUserId()`, validates expense belongs to user

### Dashboard query enhancement

Extend `getDashboardData()` to compute and return due (unpaid) payments:

```typescript
duePayments: Array<{
  expenseId: string
  name: string
  amount: string
  dueDay: number
  paymentMethod: string
  year: number
  month: number
  isOverdue: boolean
  daysUntilDue: number  // negative = overdue
  recurrence: 'monthly' | 'yearly'
}>
```

## UI

### Dashboard: replace "Proximos Vencimentos" with "Pagamentos Pendentes"

New `DuePayments` component replaces `UpcomingPayments`.

**Layout:**

```
+-- Pagamentos Pendentes -----------------------------------+
|                                                           |
|  ATRASADO -- Janeiro 2026                                 |
|  O   Netflix          Dia 5  . Pix        R$ 55,90       |
|                                                           |
|  ATRASADO -- Fevereiro 2026                               |
|  O   Gym              Dia 10 . Cartao     R$ 89,00       |
|                                                           |
|  ESTE MES -- Fevereiro 2026                               |
|  O   Internet         Dia 25 . Boleto     R$120,00       |
|  O   Electricity      Dia 28 . Deb. Aut.  R$ 95,00      |
|                                                           |
|  PAGOS (2)                                    [Mostrar v] |
+-----------------------------------------------------------+
```

### Mark as paid (one-click)

- Each row has a circle checkbox on the left
- Click triggers: smooth check animation, name gets strikethrough, row fades to muted/green tone
- After brief delay, item slides to collapsed "Pagos" section
- API call: `POST /api/expenses/[id]/payments` with `{ year, month }`
- Optimistic update for instant feedback

### Unmark payment (with confirmation)

- Expand "Pagos" section to see paid items (checked circles)
- Click checked circle opens confirmation dialog: "Desmarcar pagamento de [expense] em [month/year]?"
- On confirm: `DELETE /api/expenses/[id]/payments`, item returns to unpaid list

### Visual accents

- **Overdue items:** red/warning left border or badge
- **Current month items:** neutral styling
- **Paid items:** muted with green check, collapsed by default

## Edge Cases

- **Expense created mid-month:** first eligible month is the `startDate`'s month regardless of day
- **Expense deactivated:** no new due payments beyond current month; past unpaid months still show as overdue
- **Expense deleted:** CASCADE deletes all payment records
- **dueDay mandatory:** enforced at DB level, no null handling needed

## Out of Scope

- Payment history page
- Notifications/reminders
- Partial payments
- Per-month amount overrides (uses current expense amount)
