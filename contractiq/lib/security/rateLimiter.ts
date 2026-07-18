import { createAdminClient } from '@/lib/supabase/admin'
import { HttpError } from '@/lib/utils/api'

/**
 * Sliding-window rate limiter backed by the `rate_limit_events` table
 * (created by supabase/rls-policies.sql). Uses the service-role client so the
 * limiter is not itself subject to RLS.
 *
 * Throws HttpError(429) when the caller exceeds `limit` actions within `windowSeconds`.
 */
export async function enforceRateLimit(
  userId: string,
  action: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const admin = createAdminClient()
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString()

  const { count, error } = await admin
    .from('rate_limit_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', since)

  if (error) {
    // Fail open on limiter infrastructure errors, but log — never block legitimate work.
    console.error('[rateLimiter] count failed:', error.message)
    return
  }

  if ((count ?? 0) >= limit) {
    throw new HttpError(429, 'rate_limited', 'Too many requests. Please try again in a few minutes.')
  }

  const { error: insertError } = await admin
    .from('rate_limit_events')
    .insert({ user_id: userId, action })
  if (insertError) console.error('[rateLimiter] insert failed:', insertError.message)
}

/** Default limits per action (per user). */
export const RATE_LIMITS = {
  upload: { limit: 20, windowSeconds: 60 * 60 },
  process: { limit: 30, windowSeconds: 60 * 60 },
  chat: { limit: 60, windowSeconds: 60 * 60 },
} as const
