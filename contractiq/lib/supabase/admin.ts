import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * SERVER ONLY. Service-role client that bypasses RLS.
 * Use only for trusted server-side writes AFTER the caller's identity and
 * ownership have been verified (e.g. persisting extraction results). Always
 * scope writes to the verified user_id — never expose to the client.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}
