'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, FileDown, FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const [open, setOpen] = useState(false)
  const [generating, setGenerating] = useState<ExportKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current?.contains(event.target as Node)) return
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleExport(kind: ExportKind) {
    setGenerating(kind)
    setError(null)

    try {
      await new Promise((resolve) => setTimeout(resolve, 0))

      if (kind === 'csv') {
        downloadExpensesCsv(expenses, scope)
      } else {
        downloadExpensesXlsx(expenses, scope)
      }
      setOpen(false)
    } catch {
      setError('Não foi possível gerar o arquivo. Tente novamente.')
    } finally {
      setGenerating(null)
    }
  }

  const disabled = expenses.length === 0 || generating !== null

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        onClick={() => {
          setError(null)
          setOpen((current) => !current)
        }}
        disabled={expenses.length === 0}
        aria-expanded={open}
      >
        <FileDown />
        Exportar
        <ChevronDown className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </Button>

      {open && (
        <div
          className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-md border bg-popover p-5 text-popover-foreground shadow-md"
          role="dialog"
          aria-label="Exportar despesas"
        >
          <div className="space-y-5">
            <label className="flex flex-col gap-2 text-sm font-medium">
              <span>Despesas</span>
              <select
                value={scope}
                onChange={(event) => setScope(event.target.value as ExpenseExportScope)}
                disabled={disabled}
                className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="all">{scopeLabels.all}</option>
                <option value="monthly">{scopeLabels.monthly}</option>
                <option value="separate">{scopeLabels.separate}</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => handleExport('csv')}
                disabled={disabled}
              >
                <FileText />
                {generating === 'csv' ? 'Gerando...' : 'CSV'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => handleExport('xlsx')}
                disabled={disabled}
              >
                <FileSpreadsheet />
                {generating === 'xlsx' ? 'Gerando...' : 'Excel'}
              </Button>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </div>
      )}
    </div>
  )
}
