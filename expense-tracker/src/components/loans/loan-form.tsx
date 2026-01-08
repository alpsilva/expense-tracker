'use client'

import { useState } from 'react'
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
import type { Person } from '@/db/schema'

interface LoanFormProps {
  people: Person[]
  onSuccess?: () => void
}

export function LoanForm({ people, onSuccess }: LoanFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [useNewPerson, setUseNewPerson] = useState(people.length === 0)

  const [formData, setFormData] = useState({
    personId: '',
    personName: '',
    personNickname: '',
    personRelationship: '',
    direction: 'lent',
    amount: '',
    reason: '',
    transactionDate: new Date().toISOString().split('T')[0],
    expectedSettlement: '',
    notes: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        transactionDate: new Date(formData.transactionDate).toISOString(),
        expectedSettlement: formData.expectedSettlement
          ? new Date(formData.expectedSettlement).toISOString()
          : null,
        personId: useNewPerson ? undefined : formData.personId,
        personName: useNewPerson ? formData.personName : undefined,
        personNickname: useNewPerson ? formData.personNickname : undefined,
        personRelationship: useNewPerson ? formData.personRelationship : undefined,
      }

      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        onSuccess?.()
        router.push('/loans')
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo Empréstimo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Direção</Label>
            <Select
              value={formData.direction}
              onValueChange={(value) => setFormData({ ...formData, direction: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lent">Eu emprestei (me devem)</SelectItem>
                <SelectItem value="borrowed">Eu peguei emprestado (eu devo)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {people.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={!useNewPerson ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUseNewPerson(false)}
              >
                Pessoa existente
              </Button>
              <Button
                type="button"
                variant={useNewPerson ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUseNewPerson(true)}
              >
                Nova pessoa
              </Button>
            </div>
          )}

          {!useNewPerson && people.length > 0 ? (
            <div className="space-y-2">
              <Label>Pessoa</Label>
              <Select
                value={formData.personId}
                onValueChange={(value) => setFormData({ ...formData, personId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma pessoa" />
                </SelectTrigger>
                <SelectContent>
                  {people.map((person) => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name} {person.nickname && `(${person.nickname})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-4 p-4 border rounded-lg">
              <p className="text-sm font-medium">Nova pessoa</p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="personName">Nome *</Label>
                  <Input
                    id="personName"
                    value={formData.personName}
                    onChange={(e) => setFormData({ ...formData, personName: e.target.value })}
                    placeholder="Nome completo"
                    required={useNewPerson}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personNickname">Apelido</Label>
                  <Input
                    id="personNickname"
                    value={formData.personNickname}
                    onChange={(e) => setFormData({ ...formData, personNickname: e.target.value })}
                    placeholder="Como você chama"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="personRelationship">Relacionamento</Label>
                <Input
                  id="personRelationship"
                  value={formData.personRelationship}
                  onChange={(e) => setFormData({ ...formData, personRelationship: e.target.value })}
                  placeholder="Ex: primo, colega de trabalho"
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
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

            <div className="space-y-2">
              <Label htmlFor="transactionDate">Data *</Label>
              <Input
                id="transactionDate"
                type="date"
                value={formData.transactionDate}
                onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo *</Label>
            <Input
              id="reason"
              value={formData.reason}
              onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              placeholder="Ex: Conserto do carro"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="expectedSettlement">Previsão de Pagamento</Label>
            <Input
              id="expectedSettlement"
              type="date"
              value={formData.expectedSettlement}
              onChange={(e) => setFormData({ ...formData, expectedSettlement: e.target.value })}
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

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Salvando...' : 'Criar'}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
