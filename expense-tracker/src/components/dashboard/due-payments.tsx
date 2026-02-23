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
              label = `Este m\u00EAs \u2014 ${monthNames[month]} ${year}`
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
