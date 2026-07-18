export const runtime = 'nodejs'
export const maxDuration = 60

import { handleRoute, apiJson, HttpError } from '@/lib/utils/api'
import { requireAuth } from '@/lib/security/authGuard'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rateLimiter'
import { requireOwnedContract } from '@/lib/security/chatSecurity'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { extractTerms } from '@/lib/openai/extractTerms'
import { createAdminClient } from '@/lib/supabase/admin'
import { processSchema } from '@/lib/validation/schemas'
import { LIMITS } from '@/lib/constants/terms'
import type { KeyTerm } from '@/types'

/**
 * POST /api/contracts/[id]/process
 * body: { custom_terms?: string[] } (≤ 5)
 * → 200 { contract_id, status: 'complete', key_terms }
 *
 * Sanitises custom terms, marks the contract processing, runs GPT-4o extraction,
 * persists the results with the admin client (scoped to the verified user), and
 * flips status to complete. Any AI failure rolls the contract to `error`.
 */
export const POST = handleRoute(async (req: Request, { params }: { params: { id: string } }) => {
  const { user, supabase } = await requireAuth()

  await enforceRateLimit(user.id, 'process', RATE_LIMITS.process.limit, RATE_LIMITS.process.windowSeconds)

  const contract = await requireOwnedContract(supabase, params.id, user.id)

  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    // Empty / missing body is valid — custom_terms defaults to [].
    body = {}
  }

  const { custom_terms } = processSchema.parse(body)

  // Sanitise, trim, drop empties, and dedupe (case-insensitive) custom terms.
  const seen = new Set<string>()
  const customTerms: string[] = []
  for (const raw of custom_terms) {
    const { sanitized } = sanitizeForLLM(raw)
    const trimmed = sanitized.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    customTerms.push(trimmed)
  }

  if (customTerms.length > LIMITS.MAX_CUSTOM_TERMS) {
    throw new HttpError(
      400,
      'too_many_custom_terms',
      `You can add up to ${LIMITS.MAX_CUSTOM_TERMS} custom terms.`,
    )
  }

  const { error: processingError } = await supabase
    .from('contracts')
    .update({ status: 'processing' })
    .eq('id', contract.id)
  if (processingError) {
    console.error('[process] status=processing update failed:', processingError.message)
  }

  if (customTerms.length > 0) {
    const { error: customError } = await supabase.from('custom_key_terms').insert(
      customTerms.map((term_name) => ({
        contract_id: contract.id,
        user_id: user.id,
        term_name,
        is_manual: true,
      })),
    )
    if (customError) {
      console.error('[process] custom_key_terms insert failed:', customError.message)
    }
  }

  try {
    const terms = await extractTerms({
      contractText: contract.contract_text,
      contractType: contract.contract_type,
      customTerms,
    })

    const admin = createAdminClient()

    const rows = terms.map((t) => ({
      contract_id: contract.id,
      user_id: user.id,
      term_name: t.term_name,
      value: t.value,
      page_number: t.page_number,
      confidence_score: t.confidence_score,
      source_sentence: t.source_sentence,
      is_custom: customTerms.includes(t.term_name),
    }))

    let keyTerms: KeyTerm[] = []
    if (rows.length > 0) {
      const { data: insertedTerms, error: termsError } = await admin
        .from('key_terms')
        .insert(rows)
        .select('*')
      if (termsError) {
        console.error('[process] key_terms insert failed:', termsError.message)
        throw new Error(termsError.message)
      }
      keyTerms = (insertedTerms ?? []) as KeyTerm[]
    }

    const { error: completeError } = await supabase
      .from('contracts')
      .update({ status: 'complete' })
      .eq('id', contract.id)
    if (completeError) {
      console.error('[process] status=complete update failed:', completeError.message)
    }

    return apiJson({ contract_id: contract.id, status: 'complete' as const, key_terms: keyTerms })
  } catch (err) {
    console.error('[process] extraction failed:', err)
    const { error: errorStatusError } = await supabase
      .from('contracts')
      .update({ status: 'error' })
      .eq('id', contract.id)
    if (errorStatusError) {
      console.error('[process] status=error update failed:', errorStatusError.message)
    }
    throw new HttpError(502, 'openai_error', 'AI analysis failed. Please try again in a few minutes.')
  }
})
