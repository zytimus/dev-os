import { handleRoute, apiJson, HttpError } from '@/lib/utils/api'
import { authSchema } from '@/lib/validation/schemas'
import { createClient } from '@/lib/supabase/server'

/**
 * Server-side login. Validates credentials and signs in via the server client,
 * which sets the auth session cookies on the response.
 */
export const POST = handleRoute(async (req) => {
  const body = await req.json().catch(() => null)
  const { email, password } = authSchema.parse(body)

  const supabase = createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    throw new HttpError(401, 'invalid_credentials', 'Invalid email or password.')
  }

  return apiJson({ ok: true })
})
