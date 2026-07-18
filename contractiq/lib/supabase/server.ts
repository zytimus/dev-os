import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Server Supabase client bound to the request cookies.
 * Use in Server Components and Route Handlers. Reads the session from cookies
 * and enforces RLS as the authenticated user.
 */
export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // `set` throws in Server Components (read-only cookies); safe to ignore —
            // the session is refreshed by middleware.
          }
        },
      },
    },
  )
}
