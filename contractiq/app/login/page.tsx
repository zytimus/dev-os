import { Suspense } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { AuthForm } from '@/components/auth/AuthForm'

export default function LoginPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-surface px-4 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="text-h5 font-semibold text-brand transition-colors duration-150 ease-out hover:text-brand-hover"
          >
            ContractIQ
          </Link>
        </div>

        <Card className="p-8">
          <h1 className="mb-6 text-center text-h3 text-ink">Welcome back</h1>
          <Suspense
            fallback={
              <div className="flex justify-center py-8 text-muted">
                <Spinner size={24} />
              </div>
            }
          >
            <AuthForm mode="login" />
          </Suspense>
        </Card>
      </div>
    </main>
  )
}
