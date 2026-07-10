'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Archive, RotateCcw } from 'lucide-react'
import type { RecurringExpense } from '@/db/schema'
import { formatCurrency, formatDate, formatDueDate, paymentMethodLabels, categoryLabels } from '@/lib/formatters'

const categories = [
  { value: 'subscription', label: 'Assinatura' },
  { value: 'utility', label: 'Utilidade' },
  { value: 'insurance', label: 'Seguro' },
  { value: 'rent', label: 'Aluguel' },
  { value: 'loan_payment', label: 'Financiamento' },
  { value: 'membership', label: 'Mensalidade' },
  { value: 'education', label: 'Educação' },
  { value: 'transport', label: 'Transporte' },
  { value: 'other', label: 'Outro' },
]

const paymentMethods = [
  { value: 'pix', label: 'Pix' },
  { value: 'credit_card', label: 'Cartão de Crédito' },
  { value: 'debit_card', label: 'Cartão de Débito' },
  { value: 'boleto', label: 'Boleto' },
  { value: 'automatic_debit', label: 'Débito Automático' },
  { value: 'bank_transfer', label: 'Transferência' },
  { value: 'cash', label: 'Dinheiro' },
  { value: 'other', label: 'Outro' },
]

interface ExpenseFormProps {
  expense?: RecurringExpense
  onSuccess?: () => void
}

function ReadOnlyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="max-w-[65%] text-right font-medium">{children}</span>
    </div>
  )
}

export function ExpenseForm({ expense, onSuccess }: ExpenseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [lifecycleLoading, setLifecycleLoading] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    name: expense?.name ?? '',
    description: expense?.description ?? '',
    amount: expense?.amount ?? '',
    category: expense?.category ?? 'other' as string,
    recurrence: expense?.recurrence ?? 'monthly' as string,
    paymentMethod: expense?.paymentMethod ?? 'pix' as string,
    dueDay: expense?.dueDay?.toString() ?? '',
    dueMonth: expense?.dueMonth?.toString() ?? '',
    startDate: expense?.startDate ? new Date(expense.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    notes: expense?.notes ?? '',
    url: expense?.url ?? '',
    isActive: expense?.isActive ?? true,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        dueDay: parseInt(formData.dueDay),
        dueMonth: formData.dueMonth ? parseInt(formData.dueMonth) : null,
        startDate: new Date(formData.startDate).toISOString(),
      }

      const url = expense ? `/api/expenses/${expense.id}` : '/api/expenses'
      const method = expense ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onSuccess?.()
        router.push('/expenses')
        router.refresh()
        return
      }

      setError('Não foi possível salvar a despesa. Tente novamente.')
    } catch {
      setError('Não foi possível salvar a despesa. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLifecycleChange(isActive: boolean) {
    if (!expense) return

    setLifecycleLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      })

      if (!res.ok) {
        setError(
          isActive
            ? 'Não foi possível reativar a despesa. Tente novamente.'
            : 'Não foi possível arquivar a despesa. Tente novamente.'
        )
        return
      }

      onSuccess?.()
      router.push('/expenses')
      router.refresh()
    } catch {
      setError(
        isActive
          ? 'Não foi possível reativar a despesa. Tente novamente.'
          : 'Não foi possível arquivar a despesa. Tente novamente.'
      )
    } finally {
      setLifecycleLoading(false)
      setArchiveOpen(false)
    }
  }

  if (expense && !expense.isActive) {
    return (
      <Card className="border-dashed bg-muted/30 shadow-none">
        <CardHeader>
          <CardTitle>Despesa Inativa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{expense.name}</h1>
            {expense.description && (
              <p className="text-muted-foreground">{expense.description}</p>
            )}
          </div>

          <div className="space-y-3 rounded-md border bg-background p-4">
            <ReadOnlyRow label="Valor">{formatCurrency(expense.amount)}</ReadOnlyRow>
            <ReadOnlyRow label="Recorrência">
              {expense.recurrence === 'monthly' ? 'Mensal' : 'Anual'}
            </ReadOnlyRow>
            <ReadOnlyRow label="Vencimento">
              {formatDueDate(expense.dueDay, expense.dueMonth ?? undefined)}
            </ReadOnlyRow>
            <ReadOnlyRow label="Categoria">{categoryLabels[expense.category]}</ReadOnlyRow>
            <ReadOnlyRow label="Pagamento">{paymentMethodLabels[expense.paymentMethod]}</ReadOnlyRow>
            <ReadOnlyRow label="Início">{formatDate(expense.startDate)}</ReadOnlyRow>
          </div>

          {(expense.notes || expense.url) && (
            <div className="space-y-3 rounded-md border bg-background p-4 text-sm">
              {expense.notes && (
                <div>
                  <p className="font-medium">Observações</p>
                  <p className="text-muted-foreground">{expense.notes}</p>
                </div>
              )}
              {expense.url && (
                <div>
                  <p className="font-medium">URL</p>
                  <p className="break-all text-muted-foreground">{expense.url}</p>
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="pt-2">
            <Button
              type="button"
              onClick={() => handleLifecycleChange(true)}
              disabled={lifecycleLoading}
            >
              <RotateCcw />
              {lifecycleLoading ? 'Reativando...' : 'Reativar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{expense ? 'Editar Despesa' : 'Nova Despesa'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Netflix"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Valor (R$) *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descrição opcional"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Recorrência</Label>
              <Select
                value={formData.recurrence}
                onValueChange={(value) => setFormData({ ...formData, recurrence: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Método de Pagamento</Label>
              <Select
                value={formData.paymentMethod}
                onValueChange={(value) => setFormData({ ...formData, paymentMethod: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="dueDay">Dia de Vencimento *</Label>
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
            </div>

            {formData.recurrence === 'yearly' && (
              <div className="space-y-2">
                <Label htmlFor="dueMonth">Mês de Vencimento</Label>
                <Input
                  id="dueMonth"
                  type="number"
                  min="1"
                  max="12"
                  value={formData.dueMonth}
                  onChange={(e) => setFormData({ ...formData, dueMonth: e.target.value })}
                  placeholder="1-12"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="startDate">Data de Início</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="url">URL (link para gerenciar)</Label>
            <Input
              id="url"
              type="url"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              placeholder="https://..."
            />
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2">
              <Button type="submit" disabled={loading || lifecycleLoading}>
                {loading ? 'Salvando...' : expense ? 'Atualizar' : 'Criar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading || lifecycleLoading}
              >
                Cancelar
              </Button>
            </div>

            {expense && (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setArchiveOpen(true)}
                disabled={loading || lifecycleLoading}
              >
                <Archive />
                Arquivar Despesa
              </Button>
            )}
          </div>
        </form>

        {expense && (
          <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Arquivar despesa?</DialogTitle>
                <DialogDescription>
                  {expense.name} deixará de aparecer nas despesas recorrentes ativas e nos pagamentos pendentes, mas o histórico será preservado.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setArchiveOpen(false)}
                  disabled={lifecycleLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleLifecycleChange(false)}
                  disabled={lifecycleLoading}
                >
                  <Archive />
                  {lifecycleLoading ? 'Arquivando...' : 'Arquivar'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardContent>
    </Card>
  )
}
