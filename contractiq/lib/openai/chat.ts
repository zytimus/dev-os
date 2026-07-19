import type { ChatMessage, QueryMode } from '@/types'
import { LIMITS } from '@/lib/constants/terms'
import { getOpenAI, OPENAI_MODEL, OPENAI_USER_TAG, withRetry } from './client'
import { buildChatSystemPrompt } from './prompts'

export type { QueryMode }

/**
 * Derives the attribution source from the tags the model appended to its answer.
 * The unified prompt instructs the model to end contract facts with [Page X] and
 * conversation facts with [From conversation]; we read those back for the UI badge.
 * Defaults to 'contract' when no tag is present (e.g. a brief "not found" reply).
 */
export function deriveSource(answer: string): QueryMode {
  const hasPage = /\[page\s+\d+\]/i.test(answer)
  const hasConversation = /\[from conversation\]/i.test(answer)
  if (hasPage && hasConversation) return 'both'
  if (hasConversation) return 'history'
  return 'contract'
}

/** Extracts the last [Page N] citation from an answer, if any. */
export function parsePageCitation(text: string): number | null {
  const matches = [...text.matchAll(/\[page\s+(\d+)\]/gi)]
  if (matches.length === 0) return null
  const last = matches[matches.length - 1]
  const n = parseInt(last[1], 10)
  return Number.isFinite(n) ? n : null
}

export interface ChatArgs {
  contractText: string
  /**
   * Conversation history, ascending. Loaded from the DB BEFORE the new user
   * message is saved, so the current question is not duplicated in the history.
   */
  history: ChatMessage[]
  message: string
}

export interface ChatResult {
  answer: string
  /** Which context the answer was sourced from — used for UI attribution. */
  source: QueryMode
}

/** Shown only if the model returns an empty completion. */
const EMPTY_FALLBACK = "I couldn't generate a response. Please try rephrasing your question."

/**
 * Runs one grounded chat turn through the Conversation Memory Layer.
 *
 * The model receives BOTH the contract text and the recent conversation on every
 * turn and decides which to draw on — so it can answer document questions (with
 * [Page X] citations) and conversational/memory questions (e.g. "what is my
 * name?") in the same thread. The attribution source is derived from the tags in
 * the answer. (temp 0.4, max 1000 tokens)
 */
export async function chat({ contractText, history, message }: ChatArgs): Promise<ChatResult> {
  const openai = getOpenAI()

  // Send the most recent turns alongside the document. capHistory() upstream has
  // already bounded the total to a token-safe window.
  const historyMessages = history.slice(-LIMITS.CHAT_HISTORY_WINDOW).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const system = buildChatSystemPrompt(contractText)

  const completion = await withRetry(() =>
    openai.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.4,
      max_tokens: 1000,
      user: OPENAI_USER_TAG,
      messages: [
        { role: 'system', content: system },
        ...historyMessages,
        { role: 'user', content: message },
      ],
    }),
  )

  const answer = completion.choices[0]?.message?.content?.trim() || EMPTY_FALLBACK
  return { answer, source: deriveSource(answer) }
}
