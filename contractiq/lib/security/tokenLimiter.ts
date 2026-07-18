import { LIMITS } from '@/lib/constants/terms'
import { HttpError } from '@/lib/utils/api'

/** Rough token estimate (~4 chars/token) — used for the ≤15k guard and cost logging. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

/** Guards contract length against the MVP token ceiling. */
export function assertWithinTokenLimit(text: string): number {
  const tokens = estimateTokens(text)
  if (tokens > LIMITS.MAX_TOKENS) {
    throw new HttpError(
      400,
      'contract_too_long',
      `This contract is too long (~${tokens.toLocaleString()} tokens). The limit is ${LIMITS.MAX_TOKENS.toLocaleString()} tokens.`,
    )
  }
  return tokens
}

/** Guards page count. */
export function assertWithinPageLimit(pageCount: number): void {
  if (pageCount > LIMITS.MAX_PAGES) {
    throw new HttpError(400, 'too_many_pages', `PDFs are limited to ${LIMITS.MAX_PAGES} pages.`)
  }
}

/** Guards against scanned/image PDFs (too little extracted text). */
export function assertHasTextLayer(wordCount: number): void {
  if (wordCount < LIMITS.MIN_WORDS) {
    throw new HttpError(
      400,
      'scanned_pdf',
      'Scanned PDFs are not supported yet. Please upload a text-based PDF.',
    )
  }
}

/** Caps chat history to the most recent N messages (keeps chronological order). */
export function capHistory<T>(messages: T[]): T[] {
  if (messages.length <= LIMITS.MAX_HISTORY_MESSAGES) return messages
  return messages.slice(messages.length - LIMITS.MAX_HISTORY_MESSAGES)
}
