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
