'use client'

import { useState } from 'react'
import { FileText, ImageDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  downloadLoanHistoryImage,
  downloadLoanHistoryPdf,
  type ExportPerson,
} from '@/lib/loan-export'

interface LoanExportActionsProps {
  person: ExportPerson
}

type ExportKind = 'pdf' | 'image'

export function LoanExportActions({ person }: LoanExportActionsProps) {
  const [generating, setGenerating] = useState<ExportKind | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleExport(kind: ExportKind) {
    setGenerating(kind)
    setError(null)

    try {
      if (kind === 'pdf') {
        downloadLoanHistoryPdf(person)
      } else {
        await downloadLoanHistoryImage(person)
      }
    } catch {
      setError('Não foi possível gerar o arquivo. Tente novamente.')
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExport('pdf')}
          disabled={generating !== null}
        >
          <FileText />
          {generating === 'pdf' ? 'Gerando PDF...' : 'Exportar PDF'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => handleExport('image')}
          disabled={generating !== null}
        >
          <ImageDown />
          {generating === 'image' ? 'Gerando imagem...' : 'Exportar imagem'}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
