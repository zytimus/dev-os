import { handleRoute, apiJson } from '@/lib/utils/api'
import { requireAuth } from '@/lib/security/authGuard'
import { requireOwnedContract } from '@/lib/security/chatSecurity'
import { feedbackSchema } from '@/lib/validation/schemas'

/** POST /api/feedback — capture thumbs up/down + optional comment on a review. */
export const POST = handleRoute(async (req) => {
  const { user, supabase } = await requireAuth()

  const body = await req.json().catch(() => null)
  const { contract_id, rating, comment } = feedbackSchema.parse(body)

  await requireOwnedContract(supabase, contract_id, user.id)

  const { data: feedback, error } = await supabase
    .from('user_feedback')
    .insert({
      contract_id,
      user_id: user.id,
      rating,
      comment: comment ?? null,
    })
    .select('id')
    .single()

  if (error || !feedback) {
    throw new Error(`Failed to save feedback: ${error?.message}`)
  }

  return apiJson({ feedback: { id: feedback.id } }, 201)
})
