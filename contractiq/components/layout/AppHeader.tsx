'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'

interface AppHeaderProps {
  email?: string
}

/** Shared top header for authenticated pages (dashboard, results). */
export function AppHeader({ email }: AppHeaderProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  async function handleSignOut() {
    setSigningOut(true)
    try {
      await createClient().auth.signOut()
      router.push('/')
      router.refresh()
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <header className="flex items-center justify-between border-b border-line bg-white px-6 py-4">
      <Link
        href="/dashboard"
        className="text-h5 font-semibold text-brand transition-colors duration-150 ease-out hover:text-brand-hover"
      >
        ContractIQ
      </Link>

      <div className="flex items-center gap-4">
        {email && (
          <span className="hidden text-body-sm text-muted sm:inline" title={email}>
            {email}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={handleSignOut} loading={signingOut}>
          Sign out
        </Button>
      </div>
    </header>
  )
}
