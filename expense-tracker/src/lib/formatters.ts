export function formatCurrency(
  amount: number | string,
  currency: string = 'BRL'
): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency,
  }).format(num)
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR').format(d)
}

export function formatDueDate(day: number, month?: number): string {
  if (month) {
    const monthName = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(
      new Date(2024, month - 1)
    )
    return `Dia ${day} de ${monthName}`
  }
  return `Todo dia ${day}`
}

export const paymentMethodLabels: Record<string, string> = {
  pix: 'Pix',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  boleto: 'Boleto',
  automatic_debit: 'Débito Automático',
  bank_transfer: 'Transferência',
  cash: 'Dinheiro',
  other: 'Outro',
}

export const categoryLabels: Record<string, string> = {
  subscription: 'Assinatura',
  utility: 'Utilidade',
  insurance: 'Seguro',
  rent: 'Aluguel',
  loan_payment: 'Financiamento',
  membership: 'Mensalidade',
  education: 'Educação',
  transport: 'Transporte',
  other: 'Outro',
}
