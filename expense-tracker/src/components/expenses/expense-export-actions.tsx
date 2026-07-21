'use client'

import { useState } from 'react'
import { FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  downloadExpensesCsv,
  downloadExpensesXlsx,
  type ExpenseExportScope,
  type ExportExpense,
} from '@/lib/expense-export'

interface ExpenseExportActionsProps {
  expenses: ExportExpense[]
}

type ExportKind = 'csv' | 'xlsx'

const scopeLabels: Record<ExpenseExportScope, string> = {
  all: 'Todas',
  monthly: 'Somente mensais',
  separate: 'Mensais e anuais separados',
}

export function ExpenseExportActions({ expenses }: ExpenseExportActionsProps) {
  const [scope, setScope] = useState<ExpenseExportScope>('all')
  const [generating, setGenerating] = useState<ExportKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExport(kind: ExportKind) {
    setGenerating(kind)
    setError(null)

    try {
      if (kind === 'csv') {
        downloadExpensesCsv(expenses, scope)
      } else {
        downloadExpensesXlsx(expenses, scope)
      }
    } catch {
      setError('Não foi possível gerar o arquivo. Tente novamente.')
    } finally {
      setGenerating(null)
    }
  }

  const disabled = expenses.length === 0 || generating !== null

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={scope}
          onValueChange={(value) => setScope(value as ExpenseExportScope)}
          disabled={disabled}
        >
          <SelectTrigger className="w-[260px] max-w-full">
            <SelectValue aria-label={scopeLabels[scope]} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{scopeLabels.all}</SelectItem>
            <SelectItem value="monthly">{scopeLabels.monthly}</SelectItem>
            <SelectItem value="separate">{scopeLabels.separate}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExport('csv')}
          disabled={disabled}
        >
          <FileText />
          {generating === 'csv' ? 'Gerando CSV...' : 'Exportar CSV'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExport('xlsx')}
          disabled={disabled}
        >
          <FileSpreadsheet />
          {generating === 'xlsx' ? 'Gerando Excel...' : 'Exportar Excel'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
