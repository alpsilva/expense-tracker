# Loan Ledger Design

## Overview

Replace the current loans system with a simpler "ledger" model. Each person has a ledger - a chronological list of money movements between you and them. The running balance shows who owes whom.

## Data Model

### Transaction Types

Two types, stored in English, displayed in Portuguese:
- `lent` → "Emprestei" (money out to them)
- `received` → "Recebi" (money in from them)

### Balance Calculation

- `lent` transactions add to balance
- `received` transactions subtract from balance
- Positive balance = they owe you
- Negative balance = you owe them

### Schema

```sql
-- Keep existing people table unchanged

-- New transactions table (replaces loans + loan_payments)
CREATE TYPE transaction_type AS ENUM ('lent', 'received');

CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  type transaction_type NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  description TEXT,
  disregarded BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);
```

### Disregard Feature

- `disregarded` boolean field (default false)
- Disregarded transactions are displayed greyed out with strikethrough
- Excluded from balance calculation
- Never deleted - preserved for audit purposes
- Can be toggled back if needed

## UI Flow

### Main Loans Page (`/loans`)

Primary view showing all people with financial relationships:
- List of people cards
- Each card shows: name, relationship, current balance (green if positive, red if negative), transaction count
- Quick-action buttons on each card: "Emprestei" and "Recebi"
- "+ Nova pessoa" button to create new ledger
- Sort options: most recent activity, highest balance, alphabetical

### Person Ledger Page (`/loans/[personId]`)

Detailed view of a single ledger:
- Header: person name, relationship, current balance (large, prominent)
- Quick-action bar: "Emprestei" and "Recebi" buttons
- Transaction list: chronological (newest first)
  - Each shows: type icon, amount, date, description
  - Disregarded items: greyed out, strikethrough
- Edit person details link

### Quick-Add Dialog

Opens when clicking transaction type buttons:
- Transaction type pre-selected based on button clicked
- Amount field (required, auto-focused)
- Date field (pre-filled with today, easily changeable)
- Description field (optional)
- Save button

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/people` | List people with computed balances |
| GET | `/api/people/[id]` | Person details + all transactions + balance |
| POST | `/api/people/[id]/transactions` | Create transaction |
| PATCH | `/api/people/[id]/transactions/[txId]` | Update transaction (toggle disregard) |

## Migration

Since the app is in early stage, the existing `loans` and `loan_payments` tables will be dropped and replaced with the new `transactions` table.

## Changes from Current System

| Current | New |
|---------|-----|
| `/loans` shows individual loans | `/loans` shows people list |
| Loans grouped with payments | Flat transaction list |
| Separate "lent" and "borrowed" directions | Single ledger, balance determines who owes whom |
| No way to exclude transactions | Disregard feature for audit-friendly exclusion |
| Complex loan + payment relationship | Simple transaction model |
