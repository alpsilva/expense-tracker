import * as XLSX from 'xlsx'
import { categoryLabels, formatDate, paymentMethodLabels } from '@/lib/formatters'
import type { RecurringExpense } from '@/db/schema'

export type ExportExpense = RecurringExpense
export type ExpenseExportScope = 'all' | 'monthly' | 'separate'

type ExportFormat = 'csv' | 'xlsx'
type ExportFileKind = 'all' | 'monthly' | 'yearly'
type CellValue = string | number
type ExportRow = Record<string, CellValue>

const recurrenceLabels: Record<RecurringExpense['recurrence'], string> = {
  monthly: 'Mensal',
  yearly: 'Anual',
}

const baseColumns = [
  'Nome',
  'Valor',
  'Moeda',
  'Recorrência',
  'Forma de pagamento',
  'Categoria',
  'Dia vencimento',
  'Ativa',
  'Data início',
] as const

const columnsWithDueMonth = [
  'Nome',
  'Valor',
  'Moeda',
  'Recorrência',
  'Forma de pagamento',
  'Categoria',
  'Dia vencimento',
  'Mês vencimento',
  'Ativa',
  'Data início',
] as const

function getColumns(kind: ExportFileKind) {
  if (kind === 'monthly') return [...baseColumns]
  return [...columnsWithDueMonth]
}

function filenameTimestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0')

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function getFilename(kind: ExportFileKind, format: ExportFormat, generatedAt: Date) {
  const prefixByKind: Record<ExportFileKind, string> = {
    all: 'despesas',
    monthly: 'despesas-mensais',
    yearly: 'despesas-anuais',
  }

  return `${prefixByKind[kind]}-${filenameTimestamp(generatedAt)}.${format}`
}

function getSheetName(kind: ExportFileKind) {
  const sheetNameByKind: Record<ExportFileKind, string> = {
    all: 'Despesas',
    monthly: 'Mensais',
    yearly: 'Anuais',
  }

  return sheetNameByKind[kind]
}

function getAnnualDueMonth(expense: ExportExpense) {
  if (expense.dueMonth) return expense.dueMonth

  const startDate = typeof expense.startDate === 'string'
    ? new Date(expense.startDate)
    : expense.startDate

  return startDate.getMonth() + 1
}

function toAmountValue(amount: string) {
  const value = Number.parseFloat(amount)
  return Number.isFinite(value) ? value : amount
}

function toExportRow(expense: ExportExpense, kind: ExportFileKind): ExportRow {
  const row: ExportRow = {
    Nome: expense.name,
    Valor: toAmountValue(expense.amount),
    Moeda: expense.currency,
    Recorrência: recurrenceLabels[expense.recurrence],
    'Forma de pagamento': paymentMethodLabels[expense.paymentMethod] ?? expense.paymentMethod,
    Categoria: categoryLabels[expense.category] ?? expense.category,
    'Dia vencimento': expense.dueDay,
    Ativa: expense.isActive ? 'Sim' : 'Não',
    'Data início': formatDate(expense.startDate),
  }

  if (kind !== 'monthly') {
    row['Mês vencimento'] = expense.recurrence === 'yearly' ? getAnnualDueMonth(expense) : ''
  }

  return row
}

function getExportGroups(expenses: ExportExpense[], scope: ExpenseExportScope) {
  if (scope === 'separate') {
    return [
      {
        kind: 'monthly' as const,
        expenses: expenses.filter((expense) => expense.recurrence === 'monthly'),
      },
      {
        kind: 'yearly' as const,
        expenses: expenses.filter((expense) => expense.recurrence === 'yearly'),
      },
    ]
  }

  if (scope === 'monthly') {
    return [
      {
        kind: 'monthly' as const,
        expenses: expenses.filter((expense) => expense.recurrence === 'monthly'),
      },
    ]
  }

  return [{ kind: 'all' as const, expenses }]
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function escapeCsvCell(value: CellValue) {
  const text = String(value)

  if (!/[",\r\n]/.test(text)) return text

  return `"${text.replace(/"/g, '""')}"`
}

function buildCsv(columns: string[], rows: ExportRow[]) {
  const csvRows = [
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? '')),
  ]

  return csvRows
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')
}

function downloadCsvFile(expenses: ExportExpense[], kind: ExportFileKind, generatedAt: Date) {
  const columns = getColumns(kind)
  const rows = expenses.map((expense) => toExportRow(expense, kind))
  const csv = buildCsv(columns, rows)
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })

  triggerBlobDownload(blob, getFilename(kind, 'csv', generatedAt))
}

function downloadXlsxFile(expenses: ExportExpense[], kind: ExportFileKind, generatedAt: Date) {
  const columns = getColumns(kind)
  const rows = expenses.map((expense) => toExportRow(expense, kind))
  const worksheetData = [
    columns,
    ...rows.map((row) => columns.map((column) => row[column] ?? '')),
  ]
  const workbook = XLSX.utils.book_new()
  const worksheet = XLSX.utils.aoa_to_sheet(worksheetData)

  worksheet['!cols'] = columns.map((column) => ({ wch: Math.max(column.length + 2, 14) }))

  XLSX.utils.book_append_sheet(workbook, worksheet, getSheetName(kind))
  XLSX.writeFile(workbook, getFilename(kind, 'xlsx', generatedAt))
}

export function downloadExpensesCsv(expenses: ExportExpense[], scope: ExpenseExportScope) {
  const generatedAt = new Date()

  for (const group of getExportGroups(expenses, scope)) {
    downloadCsvFile(group.expenses, group.kind, generatedAt)
  }
}

export function downloadExpensesXlsx(expenses: ExportExpense[], scope: ExpenseExportScope) {
  const generatedAt = new Date()

  for (const group of getExportGroups(expenses, scope)) {
    downloadXlsxFile(group.expenses, group.kind, generatedAt)
  }
}
