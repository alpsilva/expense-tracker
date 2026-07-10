import { jsPDF } from 'jspdf'
import { formatCurrency, formatDate } from '@/lib/formatters'

export interface ExportTransaction {
  id: string
  type: 'lent' | 'received'
  amount: string
  date: string
  description: string | null
  disregarded: boolean
  createdAt: string
}

export interface ExportPerson {
  id: string
  name: string
  nickname: string | null
  email: string | null
  phone: string | null
  relationship: string | null
  notes: string | null
  balance: number
  balanceDirection: 'they_owe_me' | 'i_owe_them' | 'settled'
  transactions: ExportTransaction[]
}

interface LoanStats {
  totalLoaned: number
  totalPaid: number
  balance: number
  transactionCount: number
  ignoredCount: number
}

const IMAGE_WIDTH = 1080
const IMAGE_HEIGHT = 1920
const IMAGE_TRANSACTION_LIMIT = 20

function getStats(person: ExportPerson): LoanStats {
  return person.transactions.reduce(
    (stats, tx) => {
      if (tx.disregarded) {
        stats.ignoredCount += 1
        return stats
      }

      const amount = parseFloat(tx.amount)
      stats.transactionCount += 1

      if (tx.type === 'lent') {
        stats.totalLoaned += amount
        stats.balance += amount
      } else {
        stats.totalPaid += amount
        stats.balance -= amount
      }

      return stats
    },
    {
      totalLoaned: 0,
      totalPaid: 0,
      balance: 0,
      transactionCount: 0,
      ignoredCount: 0,
    }
  )
}

function formatMoney(amount: number) {
  return formatCurrency(amount).replace(/\u00a0/g, ' ')
}

function formatSignedTransactionValue(tx: ExportTransaction) {
  const amount = parseFloat(tx.amount)
  const sign = tx.type === 'lent' ? '-' : '+'
  return `${sign} ${formatMoney(amount)}`
}

function formatGeneratedAt(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date)
}

function formatBalanceLabel(balance: number) {
  if (balance > 0) return `Me deve ${formatMoney(balance)}`
  if (balance < 0) return `Eu devo ${formatMoney(Math.abs(balance))}`
  return 'Quitado'
}

function formatImageBalanceValue(balance: number) {
  if (balance < 0) return `- ${formatMoney(Math.abs(balance))}`
  return formatMoney(balance)
}

function safeFilenamePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'pessoa'
}

function filenameTimestamp(date: Date) {
  const pad = (value: number) => value.toString().padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}`
}

function getFilename(person: ExportPerson, extension: 'pdf' | 'png', generatedAt: Date) {
  return `historico-emprestimos-${safeFilenamePart(person.name)}-${filenameTimestamp(generatedAt)}.${extension}`
}

function personInfoLines(person: ExportPerson) {
  return [
    person.nickname ? `Apelido: ${person.nickname}` : null,
    person.relationship ? `Relação: ${person.relationship}` : null,
    person.email ? `Email: ${person.email}` : null,
    person.phone ? `Telefone: ${person.phone}` : null,
    person.notes ? `Notas: ${person.notes}` : null,
  ].filter((line): line is string => Boolean(line))
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
}

function addPdfHeader(doc: jsPDF, person: ExportPerson, stats: LoanStats, generatedAt: Date) {
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 18

  doc.setFillColor(24, 33, 43)
  doc.rect(0, 0, pageWidth, 34, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('Histórico de Empréstimos', 14, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Gerado em ${formatGeneratedAt(generatedAt)}`, pageWidth - 14, y, { align: 'right' })

  y = 46
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text(person.name, 14, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  y += 7
  for (const line of personInfoLines(person)) {
    const wrapped = doc.splitTextToSize(line, 84)
    doc.text(wrapped, 14, y)
    y += wrapped.length * 5
  }

  const statsX = 112
  let statsY = 46
  const statLines = [
    `Total emprestado: ${formatMoney(stats.totalLoaned)}`,
    `Total pago: ${formatMoney(stats.totalPaid)}`,
    `Saldo: ${formatBalanceLabel(stats.balance)}`,
    `Transações consideradas: ${stats.transactionCount}`,
    `Transações ignoradas: ${stats.ignoredCount}`,
  ]

  doc.setFont('helvetica', 'bold')
  doc.text('Resumo', statsX, statsY)
  doc.setFont('helvetica', 'normal')
  statsY += 7
  for (const line of statLines) {
    doc.text(line, statsX, statsY)
    statsY += 6
  }

  return Math.max(y, statsY) + 8
}

function addPdfTableHeader(doc: jsPDF, y: number) {
  doc.setFillColor(243, 244, 246)
  doc.rect(14, y, 182, 9, 'F')
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.text('Valor', 17, y + 6)
  doc.text('Data', 55, y + 6)
  doc.text('Observação', 88, y + 6)
  return y + 11
}

export function downloadLoanHistoryPdf(person: ExportPerson) {
  const generatedAt = new Date()
  const stats = getStats(person)
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageHeight = doc.internal.pageSize.getHeight()
  const pageWidth = doc.internal.pageSize.getWidth()

  let y = addPdfHeader(doc, person, stats, generatedAt)
  y = addPdfTableHeader(doc, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)

  if (person.transactions.length === 0) {
    doc.setTextColor(100, 116, 139)
    doc.text('Nenhuma transação registrada.', 14, y + 6)
  }

  for (const tx of person.transactions) {
    const note = [
      tx.disregarded ? 'Ignorado' : null,
      tx.description || 'Sem observação',
    ].filter(Boolean).join(' - ')
    const noteLines = doc.splitTextToSize(note, 104)
    const rowHeight = Math.max(10, noteLines.length * 5 + 4)

    if (y + rowHeight > pageHeight - 18) {
      doc.addPage()
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text(`Histórico de ${person.name}`, 14, 12)
      doc.text(`Página ${doc.getNumberOfPages()}`, pageWidth - 14, 12, { align: 'right' })
      y = addPdfTableHeader(doc, 20)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
    }

    doc.setDrawColor(229, 231, 235)
    doc.line(14, y + rowHeight, 196, y + rowHeight)
    if (tx.disregarded) {
      doc.setTextColor(148, 163, 184)
    } else if (tx.type === 'lent') {
      doc.setTextColor(185, 28, 28)
    } else {
      doc.setTextColor(21, 128, 61)
    }
    doc.setFont('helvetica', 'bold')
    doc.text(formatSignedTransactionValue(tx), 17, y + 6)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(tx.disregarded ? 148 : 15, tx.disregarded ? 163 : 23, tx.disregarded ? 184 : 42)
    doc.text(formatDate(tx.date), 55, y + 6)
    doc.text(noteLines, 88, y + 6)
    y += rowHeight
  }

  doc.save(getFilename(person, 'pdf', generatedAt))
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + width, y, x + width, y + height, radius)
  ctx.arcTo(x + width, y + height, x, y + height, radius)
  ctx.arcTo(x, y + height, x, y, radius)
  ctx.arcTo(x, y, x + width, y, radius)
  ctx.closePath()
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 2
) {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  let truncated = false

  for (const word of words) {
    const nextLine = line ? `${line} ${word}` : word
    if (ctx.measureText(nextLine).width <= maxWidth) {
      line = nextLine
      continue
    }

    if (line) lines.push(line)
    line = word
    if (lines.length === maxLines) {
      truncated = true
      break
    }
  }

  if (lines.length < maxLines && line) lines.push(line)

  if (truncated && lines.length === maxLines) {
    let last = lines[maxLines - 1]
    while (ctx.measureText(`${last}...`).width > maxWidth && last.length > 0) {
      last = last.slice(0, -1)
    }
    lines[maxLines - 1] = `${last}...`
  }

  lines.forEach((lineText, index) => {
    ctx.fillText(lineText, x, y + index * lineHeight)
  })

  return lines.length * lineHeight
}

function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  options: {
    weight: number
    maxSize: number
    minSize: number
    family: string
  }
) {
  let fontSize = options.maxSize
  do {
    ctx.font = `${options.weight} ${fontSize}px ${options.family}`
    if (ctx.measureText(text).width <= maxWidth) break
    fontSize -= 1
  } while (fontSize > options.minSize)

  ctx.fillText(text, x, y)
}

function drawStatCard(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  x: number,
  y: number,
  width: number,
  accent: string
) {
  drawRoundedRect(ctx, x, y, width, 120, 22)
  ctx.fillStyle = '#ffffff'
  ctx.fill()
  ctx.fillStyle = accent
  drawRoundedRect(ctx, x, y, 10, 120, 8)
  ctx.fill()
  ctx.fillStyle = '#64748b'
  ctx.font = '500 24px Arial'
  ctx.fillText(label, x + 30, y + 42)
  ctx.fillStyle = '#0f172a'
  drawFittedText(ctx, value, x + 30, y + 88, width - 48, {
    weight: 700,
    maxSize: 34,
    minSize: 22,
    family: 'Arial',
  })
}

export async function downloadLoanHistoryImage(person: ExportPerson) {
  const generatedAt = new Date()
  const stats = getStats(person)
  const canvas = document.createElement('canvas')
  canvas.width = IMAGE_WIDTH
  canvas.height = IMAGE_HEIGHT

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable')

  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT)

  ctx.fillStyle = '#18212b'
  ctx.fillRect(0, 0, IMAGE_WIDTH, 260)
  ctx.fillStyle = '#22c55e'
  ctx.fillRect(0, 244, IMAGE_WIDTH, 16)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 58px Arial'
  ctx.fillText('Histórico de Empréstimos', 64, 92)
  ctx.font = '500 34px Arial'
  drawWrappedText(ctx, person.name, 64, 148, 620, 38, 2)
  ctx.font = '400 26px Arial'
  ctx.fillStyle = '#cbd5e1'
  ctx.fillText(`Gerado em ${formatGeneratedAt(generatedAt)}`, 64, 218)

  drawStatCard(ctx, 'Total emprestado', formatMoney(stats.totalLoaned), 64, 316, 452, '#ef4444')
  drawStatCard(ctx, 'Total pago', formatMoney(stats.totalPaid), 564, 316, 452, '#22c55e')
  drawStatCard(ctx, 'Saldo atual', formatImageBalanceValue(stats.balance), 64, 464, 452, '#0ea5e9')
  drawStatCard(ctx, 'Histórico', `${stats.transactionCount} consideradas`, 564, 464, 452, '#8b5cf6')

  ctx.fillStyle = '#334155'
  ctx.font = '500 26px Arial'
  const totalRows = person.transactions.length
  const visibleRows = person.transactions.slice(0, IMAGE_TRANSACTION_LIMIT)
  const disclaimer = `Totais calculados com todo o histórico. ${IMAGE_TRANSACTION_LIMIT} transações mais recentes abaixo.`
  drawWrappedText(ctx, disclaimer, 64, 648, 952, 32, 2)

  const tableX = 64
  let y = 736
  const tableWidth = 952
  drawRoundedRect(ctx, tableX, y - 52, tableWidth, 1090, 24)
  ctx.fillStyle = '#ffffff'
  ctx.fill()

  ctx.fillStyle = '#e2e8f0'
  ctx.fillRect(tableX, y - 52, tableWidth, 78)
  ctx.fillStyle = '#0f172a'
  ctx.font = '700 26px Arial'
  ctx.fillText('Valor', tableX + 28, y)
  ctx.fillText('Data', tableX + 252, y)
  ctx.fillText('Observação', tableX + 430, y)
  y += 50

  ctx.font = '500 24px Arial'
  if (visibleRows.length === 0) {
    ctx.fillStyle = '#64748b'
    ctx.fillText('Nenhuma transação registrada.', tableX + 28, y + 32)
  }

  for (const tx of visibleRows) {
    const rowHeight = 48
    ctx.fillStyle = tx.disregarded ? '#f8fafc' : '#ffffff'
    ctx.fillRect(tableX, y - 28, tableWidth, rowHeight)
    ctx.strokeStyle = '#e5e7eb'
    ctx.beginPath()
    ctx.moveTo(tableX + 24, y + 24)
    ctx.lineTo(tableX + tableWidth - 24, y + 24)
    ctx.stroke()

    ctx.fillStyle = tx.disregarded ? '#94a3b8' : tx.type === 'lent' ? '#b91c1c' : '#15803d'
    ctx.font = '700 24px Arial'
    ctx.fillText(formatSignedTransactionValue(tx), tableX + 28, y)

    ctx.fillStyle = tx.disregarded ? '#94a3b8' : '#334155'
    ctx.font = '500 23px Arial'
    ctx.fillText(formatDate(tx.date), tableX + 252, y)

    const note = [
      tx.disregarded ? 'Ignorado' : null,
      tx.description || 'Sem observação',
    ].filter(Boolean).join(' - ')
    drawWrappedText(ctx, note, tableX + 430, y, 532, 25, 1)
    y += rowHeight
  }

  ctx.fillStyle = '#64748b'
  ctx.font = '500 23px Arial'
  ctx.fillText(`Transações ignoradas nos totais: ${stats.ignoredCount}`, 64, 1856)
  ctx.fillStyle = '#94a3b8'
  ctx.font = '400 20px Arial'
  ctx.fillText('Expense Tracker', 64, 1896)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result)
      else reject(new Error('Image generation failed'))
    }, 'image/png')
  })

  const url = URL.createObjectURL(blob)
  triggerDownload(url, getFilename(person, 'png', generatedAt))
  URL.revokeObjectURL(url)
}
