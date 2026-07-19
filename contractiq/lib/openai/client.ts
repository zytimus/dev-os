import 'server-only'
import OpenAI from 'openai'

let cached: OpenAI | null = null

/** SERVER ONLY. Lazily-instantiated OpenAI client. */
export function getOpenAI(): OpenAI {
  if (!cached) {
    cached = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })
  }
  return cached
}

export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
export const OPENAI_USER_TAG = process.env.OPENAI_USER_TAG || undefined

/** Retries an OpenAI call up to 3× with exponential backoff on transient errors. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      const status = (err as { status?: number })?.status
      // Only retry transient failures (rate limit / server / network).
      const transient = status === undefined || status === 429 || status >= 500
      if (!transient || i === attempts - 1) break
      await new Promise((r) => setTimeout(r, 2 ** i * 500))
    }
  }
  throw lastErr
}
