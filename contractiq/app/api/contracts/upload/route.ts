export const runtime = 'nodejs'
export const maxDuration = 60

import { handleRoute, apiJson, HttpError } from '@/lib/utils/api'
import { requireAuth } from '@/lib/security/authGuard'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rateLimiter'
import { validateFileUpload } from '@/lib/security/inputValidator'
import {
  assertHasTextLayer,
  assertWithinPageLimit,
  assertWithinTokenLimit,
} from '@/lib/security/tokenLimiter'
import { extractText } from '@/lib/pdf/extractText'
import { uploadContractPdf } from '@/lib/supabase/storage'
import { uploadFieldsSchema } from '@/lib/validation/schemas'
import type { Contract } from '@/types'

/**
 * POST /api/contracts/upload
 * multipart/form-data: file (PDF), contract_type
 * → 201 { contract }
 *
 * Extracts text once (source of truth), guards scanned / oversized / too-long
 * PDFs, persists the contract row, then attempts a non-blocking Storage upload.
 */
export const POST = handleRoute(async (req: Request) => {
  const { user, supabase } = await requireAuth()

  await enforceRateLimit(user.id, 'upload', RATE_LIMITS.upload.limit, RATE_LIMITS.upload.windowSeconds)

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    throw new HttpError(400, 'invalid_file', 'Could not read the uploaded form data.')
  }

  const file = formData.get('file')
  validateFileUpload(file)

  const { contract_type } = uploadFieldsSchema.parse({
    contract_type: formData.get('contract_type'),
  })

  const buffer = Buffer.from(await file.arrayBuffer())

  let extracted
  try {
    extracted = await extractText(buffer)
  } catch (err) {
    console.error('[upload] pdf parse failed:', err)
    throw new HttpError(400, 'invalid_file', 'This PDF could not be read. It may be corrupted or password-protected.')
  }

  const { text, pageCount, tokenCount, wordCount } = extracted

  // Guards run before any row is persisted (no partial state on rejection).
  assertHasTextLayer(wordCount)
  assertWithinPageLimit(pageCount)
  assertWithinTokenLimit(text)

  const { data: inserted, error: insertError } = await supabase
    .from('contracts')
    .insert({
      user_id: user.id,
      filename: file.name,
      contract_type,
      file_path: null,
      contract_text: text,
      page_count: pageCount,
      token_count: tokenCount,
      status: 'uploaded',
    })
    .select('*')
    .single()

  if (insertError || !inserted) {
    console.error('[upload] insert failed:', insertError?.message)
    throw new HttpError(500, 'internal_error', 'Could not save the contract. Please try again.')
  }

  const contract = inserted as Contract

  // Non-blocking: a Storage failure leaves file_path null; the viewer falls back
  // to the stored text. Never fail the upload on this.
  const path = await uploadContractPdf(supabase, user.id, contract.id, file.name, buffer)
  if (path) {
    const { data: updated, error: updateError } = await supabase
      .from('contracts')
      .update({ file_path: path })
      .eq('id', contract.id)
      .select('*')
      .single()
    if (updateError) {
      console.error('[upload] file_path update failed (non-blocking):', updateError.message)
    } else if (updated) {
      return apiJson({ contract: updated as Contract }, 201)
    }
  }

  return apiJson({ contract }, 201)
})
