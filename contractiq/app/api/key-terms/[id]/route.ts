import { handleRoute, apiJson, HttpError } from '@/lib/utils/api'
import { requireAuth } from '@/lib/security/authGuard'
import { keyTermEditSchema } from '@/lib/validation/schemas'
import type { KeyTerm } from '@/types'

type RouteContext = { params: { id: string } }

/**
 * PATCH /api/key-terms/[id] — inline edit of a key term value.
 * First edit copies the current value into original_ai_value (never overwritten).
 */
export const PATCH = handleRoute(async (req, { params }: RouteContext) => {
  const { user, supabase } = await requireAuth()

  const body = await req.json().catch(() => null)
  const { value } = keyTermEditSchema.parse(body)

  const { data: term, error } = await supabase
    .from('key_terms')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !term || term.user_id !== user.id) {
    throw new HttpError(404, 'not_found', 'Key term not found.')
  }

  const original_ai_value = term.original_ai_value ?? term.value

  const { data: updated, error: updateError } = await supabase
    .from('key_terms')
    .update({ value, is_edited: true, original_ai_value })
    .eq('id', params.id)
    .select('*')
    .single()

  if (updateError || !updated) {
    throw new Error(`Failed to update key term: ${updateError?.message}`)
  }

  return apiJson({ key_term: updated as KeyTerm })
})
