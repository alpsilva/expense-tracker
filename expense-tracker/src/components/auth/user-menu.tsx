'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface User {
  id: string
  username: string
}

export function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => setUser(data.user))
  }, [])

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  if (!user) {
    return null
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-muted-foreground">
        {user.username}
      </span>
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        Sair
      </Button>
    </div>
  )
}
