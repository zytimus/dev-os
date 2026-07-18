'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { authSchema } from '@/lib/validation/schemas'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Mode = 'login' | 'signup'

interface AuthFormProps {
  mode: Mode
}

interface FieldErrors {
  email?: string
  password?: string
}

/** Maps raw Supabase auth error messages to clear, user-facing copy. */
function mapAuthError(message: string, mode: Mode): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return 'Invalid email or password.'
  }
  if (m.includes('email not confirmed')) {
    return 'Please verify your email before signing in. Check your inbox for the confirmation link.'
  }
  if (m.includes('already registered') || m.includes('already exists') || m.includes('user already')) {
    return 'An account with this email already exists. Try signing in instead.'
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts. Please wait a moment and try again.'
  }
  return mode === 'login'
    ? 'We could not sign you in. Please try again.'
    : 'We could not create your account. Please try again.'
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectedFrom = searchParams.get('redirectedFrom')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)

  const isLogin = mode === 'login'

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setFormError(null)
    setFieldErrors({})

    const parsed = authSchema.safeParse({ email, password })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'email' && !next.email) next.email = issue.message
        if (key === 'password' && !next.password) next.password = issue.message
      }
      setFieldErrors(next)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        })
        if (error) {
          setFormError(mapAuthError(error.message, mode))
          return
        }
        router.push(redirectedFrom || '/dashboard')
        router.refresh()
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) {
          setFormError(mapAuthError(error.message, mode))
          return
        }
        // If email confirmation is disabled, signUp returns an active session —
        // log the user straight in. Otherwise show the "check your email" state.
        if (data.session) {
          router.push('/dashboard')
          router.refresh()
        } else {
          setSignupSuccess(true)
        }
      }
    } catch {
      setFormError('Something went wrong. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  if (signupSuccess) {
    return (
      <div className="flex flex-col gap-4 text-center" role="status" aria-live="polite">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-50 text-success-700">
          <svg
            width={24}
            height={24}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M22 6 12 13 2 6" />
            <rect x="2" y="4" width="20" height="16" rx="2" />
          </svg>
        </div>
        <h2 className="text-h3 text-ink">Check your email to verify your account</h2>
        <p className="text-body-lg text-muted">
          We sent a confirmation link to <span className="font-medium text-ink">{email}</span>. Click
          the link to activate your account, then sign in.
        </p>
        <Link
          href="/login"
          className="text-body-sm font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        disabled={loading}
        required
      />

      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        placeholder={isLogin ? 'Your password' : 'At least 8 characters'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        disabled={loading}
        required
      />

      {formError && (
        <p
          className="rounded-input bg-danger-50 px-3 py-2 text-body-sm text-danger-700"
          role="alert"
        >
          {formError}
        </p>
      )}

      <Button type="submit" variant="primary" size="md" loading={loading} className="w-full">
        {isLogin ? 'Sign in' : 'Create account'}
      </Button>

      <p className="text-center text-body-sm text-muted">
        {isLogin ? (
          <>
            Don&apos;t have an account?{' '}
            <Link
              href="/signup"
              className="font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover"
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-brand transition-colors duration-150 ease-out hover:text-brand-hover"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  )
}
