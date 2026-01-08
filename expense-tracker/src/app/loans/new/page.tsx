'use client'

import { useEffect, useState } from 'react'
import { LoanForm } from '@/components/loans/loan-form'
import type { Person } from '@/db/schema'

export default function NewLoanPage() {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/people')
      .then((res) => res.json())
      .then((data) => {
        setPeople(data.people || [])
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="text-center py-12">Carregando...</div>
  }

  return (
    <div className="max-w-2xl mx-auto">
      <LoanForm people={people} />
    </div>
  )
}
