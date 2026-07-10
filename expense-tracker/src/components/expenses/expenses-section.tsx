'use client'

import { useState, useTransition, type ReactNode } from 'react'
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
import { ExpenseCard } from './expense-card'
import { formatCurrency, formatDate, formatDueDate, paymentMethodLabels, categoryLabels } from '@/lib/formatters'
import type { RecurringExpense } from '@/db/schema'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'

interface ExpensesSectionProps {
  title: string
  expenses: RecurringExpense[]
  total: number
}

export function ExpensesSection({ title, expenses, total }: ExpensesSectionProps) {
  const router = useRouter()

  if (expenses.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <span className="text-lg font-bold text-muted-foreground">
          Total: {formatCurrency(total)}
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        {expenses.map((expense) => (
          <ExpenseCard
            key={expense.id}
            expense={expense}
            onClick={() => router.push(`/expenses/${expense.id}`)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

interface InactiveExpensesSectionProps {
  expenses: RecurringExpense[]
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium">{children}</span>
    </div>
  )
}

export function InactiveExpensesSection({ expenses }: InactiveExpensesSectionProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [selectedExpense, setSelectedExpense] = useState<RecurringExpense | null>(null)
  const [reactivating, setReactivating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (expenses.length === 0) {
    return null
  }

  function closeDialog() {
    setSelectedExpense(null)
    setError(null)
  }

  async function reactivateExpense() {
    if (!selectedExpense) return

    setReactivating(true)
    setError(null)

    try {
      const res = await fetch(`/api/expenses/${selectedExpense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      })

      if (!res.ok) {
        setError('Não foi possível reativar a despesa. Tente novamente.')
        return
      }

      closeDialog()
      startTransition(() => {
        router.refresh()
      })
    } catch {
      setError('Não foi possível reativar a despesa. Tente novamente.')
    } finally {
      setReactivating(false)
    }
  }

  return (
    <>
      <Card className="border-dashed bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Despesas Inativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {expenses.map((expense) => (
            <ExpenseCard
              key={expense.id}
              expense={expense}
              onClick={() => setSelectedExpense(expense)}
            />
          ))}
        </CardContent>
      </Card>

      <Dialog open={selectedExpense !== null} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedExpense?.name}</DialogTitle>
            <DialogDescription>
              Esta despesa está inativa e não entra nos pagamentos pendentes.
            </DialogDescription>
          </DialogHeader>

          {selectedExpense && (
            <div className="space-y-4">
              <div className="space-y-3 rounded-md border bg-muted/40 p-4">
                <DetailRow label="Valor">
                  {formatCurrency(selectedExpense.amount)}
                </DetailRow>
                <DetailRow label="Recorrência">
                  {selectedExpense.recurrence === 'monthly' ? 'Mensal' : 'Anual'}
                </DetailRow>
                <DetailRow label="Vencimento">
                  {formatDueDate(selectedExpense.dueDay, selectedExpense.dueMonth ?? undefined)}
                </DetailRow>
                <DetailRow label="Categoria">
                  {categoryLabels[selectedExpense.category]}
                </DetailRow>
                <DetailRow label="Pagamento">
                  {paymentMethodLabels[selectedExpense.paymentMethod]}
                </DetailRow>
                <DetailRow label="Início">
                  {formatDate(selectedExpense.startDate)}
                </DetailRow>
              </div>

              {(selectedExpense.description || selectedExpense.notes || selectedExpense.url) && (
                <div className="space-y-3 rounded-md border bg-background p-4 text-sm">
                  {selectedExpense.description && (
                    <div>
                      <p className="font-medium">Descrição</p>
                      <p className="text-muted-foreground">{selectedExpense.description}</p>
                    </div>
                  )}
                  {selectedExpense.notes && (
                    <div>
                      <p className="font-medium">Observações</p>
                      <p className="text-muted-foreground">{selectedExpense.notes}</p>
                    </div>
                  )}
                  {selectedExpense.url && (
                    <div>
                      <p className="font-medium">URL</p>
                      <p className="break-all text-muted-foreground">{selectedExpense.url}</p>
                    </div>
                  )}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={reactivating}>
              Fechar
            </Button>
            <Button onClick={reactivateExpense} disabled={reactivating}>
              <RotateCcw />
              {reactivating ? 'Reativando...' : 'Reativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
