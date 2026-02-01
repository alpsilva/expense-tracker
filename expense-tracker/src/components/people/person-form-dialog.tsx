'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Person {
  id: string
  name: string
  nickname: string | null
  email: string | null
  phone: string | null
  relationship: string | null
  notes?: string | null
}

interface PersonFormDialogProps {
  person?: Person | null  // If provided, edit mode; otherwise create mode
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function PersonFormDialog({
  person,
  open,
  onOpenChange,
  onSuccess,
}: PersonFormDialogProps) {
  const isEditMode = !!person
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    relationship: '',
    notes: '',
  })

  // Reset form when dialog opens or person changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: person?.name ?? '',
        nickname: person?.nickname ?? '',
        email: person?.email ?? '',
        phone: person?.phone ?? '',
        relationship: person?.relationship ?? '',
        notes: person?.notes ?? '',
      })
    }
  }, [open, person])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const url = isEditMode ? `/api/people/${person.id}` : '/api/people'
      const method = isEditMode ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          nickname: formData.nickname || null,
          email: formData.email || null,
          phone: formData.phone || null,
          relationship: formData.relationship || null,
          notes: formData.notes || null,
        }),
      })

      if (res.ok) {
        onOpenChange(false)
        onSuccess?.()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personName">Nome *</Label>
            <Input
              id="personName"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nome completo"
              required
            />
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="personNickname">Apelido</Label>
              <Input
                id="personNickname"
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="Como você chama"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personRelationship">Relação</Label>
              <Input
                id="personRelationship"
                value={formData.relationship}
                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                placeholder="Ex: Amigo, Colega"
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="personEmail">Email</Label>
              <Input
                id="personEmail"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="personPhone">Telefone</Label>
              <Input
                id="personPhone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="personNotes">Observações</Label>
            <Textarea
              id="personNotes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Notas adicionais..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : isEditMode ? 'Salvar' : 'Criar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
