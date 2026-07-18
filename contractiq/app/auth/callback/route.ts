import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Supabase email-verification / OAuth callback.
 * Exchanges the `?code` for a session (sets auth cookies) and redirects to the
 * dashboard. Returns a redirect directly — not wrapped in handleRoute.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth', req.url))
  }

  const supabase = createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth', req.url))
  }

  return NextResponse.redirect(new URL('/dashboard', req.url))
}
