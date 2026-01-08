'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserMenu } from '@/components/auth/user-menu'

export function AppNav() {
  const pathname = usePathname()

  // Don't show nav on login page
  if (pathname === '/login') {
    return null
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="font-bold text-lg">
            Expense Tracker
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/expenses" className="text-sm font-medium hover:text-primary transition-colors">
              Despesas
            </Link>
            <Link href="/loans" className="text-sm font-medium hover:text-primary transition-colors">
              Empréstimos
            </Link>
            <Link href="/people" className="text-sm font-medium hover:text-primary transition-colors">
              Pessoas
            </Link>
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  )
}
