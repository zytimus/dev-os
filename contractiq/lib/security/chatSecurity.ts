import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contract } from '@/types'
import { HttpError } from '@/lib/utils/api'

/**
 * Loads a contract and verifies it belongs to the current user.
 * RLS already scopes queries to the user, so a miss means either not-found or
 * not-owned — both surface as 404 to avoid leaking existence.
 */
export async function requireOwnedContract(
  supabase: SupabaseClient,
  contractId: string,
  userId: string,
): Promise<Contract> {
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contractId)
    .single()

  if (error || !data || data.user_id !== userId) {
    throw new HttpError(404, 'not_found', 'Contract not found.')
  }
  return data as Contract
}

/** Verifies a chat session belongs to the given contract + user. */
export async function requireOwnedSession(
  supabase: SupabaseClient,
  sessionId: string,
  contractId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select('id, contract_id, user_id')
    .eq('id', sessionId)
    .single()

  if (error || !data || data.user_id !== userId || data.contract_id !== contractId) {
    throw new HttpError(404, 'not_found', 'Chat session not found.')
  }
}
