import { handleRoute, apiJson } from '@/lib/utils/api'
import { createClient } from '@/lib/supabase/server'

/** Server-side logout. Clears the auth session cookies. */
export const POST = handleRoute(async () => {
  const supabase = createClient()
  await supabase.auth.signOut()
  return apiJson({ ok: true })
})
