'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

interface User {
  id: string
  username: string
}

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [pathname])

  async function checkAuth() {
    try {
      const res = await fetch('/api/auth')
      const data = await res.json()

      if (data.user) {
        setUser(data.user)
      } else if (pathname !== '/login') {
        router.push('/login')
        return
      }
    } catch {
      if (pathname !== '/login') {
        router.push('/login')
        return
      }
    } finally {
      setLoading(false)
    }
  }

  // Show nothing while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    )
  }

  // Allow login page to render without auth
  if (pathname === '/login') {
    return <>{children}</>
  }

  // If not logged in and not on login page, show nothing (redirect happening)
  if (!user) {
    return null
  }

  return <>{children}</>
}
