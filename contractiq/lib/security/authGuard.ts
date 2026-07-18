import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { HttpError } from '@/lib/utils/api'

export interface AuthContext {
  user: User
  supabase: SupabaseClient
}

/**
 * Verifies the request carries a valid Supabase session.
 * Returns the authenticated user + a request-scoped Supabase client (RLS applies).
 * Throws HttpError(401) when unauthenticated — routes are wrapped by handleRoute().
 */
export async function requireAuth(): Promise<AuthContext> {
  const supabase = createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new HttpError(401, 'unauthorized', 'You must be signed in to do that.')
  }
  return { user, supabase }
}
