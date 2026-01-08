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
