import { handleRoute, apiJson } from '@/lib/utils/api'
import { requireAuth } from '@/lib/security/authGuard'
import { requireOwnedContract } from '@/lib/security/chatSecurity'
import { getSignedUrl, deleteContractObject } from '@/lib/supabase/storage'
import type { KeyTerm } from '@/types'

// Reads the session cookie — always render on demand.
export const dynamic = 'force-dynamic'

type RouteContext = { params: { id: string } }

/** GET /api/contracts/[id] — contract detail + key terms + a signed viewer URL. */
export const GET = handleRoute(async (_req, { params }: RouteContext) => {
  const { user, supabase } = await requireAuth()
  const contract = await requireOwnedContract(supabase, params.id, user.id)

  const { data: keyTerms } = await supabase
    .from('key_terms')
    .select('*')
    .eq('contract_id', contract.id)
    .order('created_at', { ascending: true })

  const signed_url = contract.file_path
    ? await getSignedUrl(supabase, contract.file_path)
    : null

  return apiJson({
    contract,
    key_terms: (keyTerms ?? []) as KeyTerm[],
    signed_url,
  })
})

/**
 * DELETE /api/contracts/[id] — removes the stored PDF (if any) and the contract
 * row. FK `on delete cascade` removes key_terms, custom_key_terms, chat_sessions,
 * chat_messages and user_feedback.
 */
export const DELETE = handleRoute(async (_req, { params }: RouteContext) => {
  const { user, supabase } = await requireAuth()
  const contract = await requireOwnedContract(supabase, params.id, user.id)

  if (contract.file_path) {
    await deleteContractObject(supabase, contract.file_path)
  }

  const { error } = await supabase.from('contracts').delete().eq('id', contract.id)
  if (error) {
    throw new Error(`Failed to delete contract: ${error.message}`)
  }

  return apiJson({ deleted: true })
})
