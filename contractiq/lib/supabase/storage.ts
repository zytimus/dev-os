import type { SupabaseClient } from '@supabase/supabase-js'
import { LIMITS, STORAGE_BUCKET } from '@/lib/constants/terms'

/** Sanitises a filename for safe use in a storage object path. */
function safeFilename(filename: string): string {
  const base = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`
}

export function contractStoragePath(userId: string, contractId: string, filename: string): string {
  return `${userId}/${contractId}/${safeFilename(filename)}`
}

/**
 * Non-blocking PDF upload. Returns the object path on success or null on failure
 * (callers keep file_path = null so the results page falls back to the text viewer).
 */
export async function uploadContractPdf(
  supabase: SupabaseClient,
  userId: string,
  contractId: string,
  filename: string,
  buffer: Buffer,
): Promise<string | null> {
  const path = contractStoragePath(userId, contractId, filename)
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, buffer, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (error) {
    console.error('[storage] upload failed (non-blocking):', error.message)
    return null
  }
  return path
}

/** Mints a signed URL for the inline viewer (default 1-hour expiry). */
export async function getSignedUrl(
  supabase: SupabaseClient,
  path: string,
  expiresIn: number = LIMITS.SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn)
  if (error || !data) {
    console.error('[storage] signed url failed:', error?.message)
    return null
  }
  return data.signedUrl
}

export async function deleteContractObject(supabase: SupabaseClient, path: string): Promise<void> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).remove([path])
  if (error) console.error('[storage] delete failed:', error.message)
}
