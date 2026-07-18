import type { ChatMessage, QueryMode } from '@/types'
import { LIMITS } from '@/lib/constants/terms'
import { getOpenAI, OPENAI_MODEL, OPENAI_USER_TAG, withRetry } from './client'
import { buildChatSystemPrompt } from './prompts'

export type { QueryMode }

/** Phrases that indicate the user is asking about the conversation itself. */
const HISTORY_SIGNALS: RegExp[] = [
  /\byou (said|mentioned|told|asked|answered|explained|replied|wrote|gave)\b/,
  /\byour (last|previous|earlier|first|prior) (answer|reply|response|message|point|question)\b/,
  /\b(repeat|rephrase|restate)\b/,
  /\bsay that again\b/,
  /\b(earlier|previously|a moment ago|just now|already) .*(you|we|i|ask|said|mention|discuss|answer)/,
  /\bwhat (did|was|were|have|had) .*(you|i|we) (say|said|ask|asked|discuss|discussed|talk|talked|mention|mentioned|tell|told)\b/,
  /\b(first|last|previous|earlier|second|third|next) (question|answer|message|thing|point)\b/,
  /\b(question|thing|point)s? (i|you|we) (asked|said|made|mentioned|raised|discussed)\b/,
  /\b(did|have|has|had) (i|you|we) (ask|asked|mention|mentioned|say|said|discuss|discussed|talk|talked|cover|covered)\b/,
  /\bwe (discussed|talked about|covered|said|went over|spoke about|were discussing)\b/,
  /\b(this|our) (chat|conversation|thread|discussion|exchange)\b/,
  /\bso far\b/,
  /\b(summar(y|ise|ize)|recap|remind me)\b.*(conversation|chat|discussion|\bwe\b|\byou\b|said|asked|told)/,
]

/** Words that indicate the user is asking about the contract document. */
const CONTRACT_SIGNAL =
  /\b(contract|document|agreement|clause|section|provision|page|terms?|party|parties|liabilit|indemnif|governing law|jurisdiction|terminat|confidential|payment|obligation|warrant|breach|notice period|effective date)\b/i

/**
 * Classifies a turn into the context it needs — CONTRACT, HISTORY, or BOTH.
 * Deterministic heuristic, no extra API call. Defaults to CONTRACT because
 * most questions are about the document.
 */
export function classifyQuery(message: string): QueryMode {
  const m = message.toLowerCase()
  const refersToHistory = HISTORY_SIGNALS.some((re) => re.test(m))
  if (!refersToHistory) return 'contract'
  // References the conversation — is it also about the document?
  return CONTRACT_SIGNAL.test(m) ? 'both' : 'history'
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
   * Full conversation history, ascending. Must be loaded from the DB BEFORE the
   * new user message is saved — otherwise the classifier would see the current
   * question as part of history and misclassify the context.
   */
  history: ChatMessage[]
  message: string
}

export interface ChatResult {
  answer: string
  /** Which context the answer was sourced from — used for UI attribution. */
  source: QueryMode
}

/** Fallback replies matched to the source, mirroring the system prompts. */
const FALLBACK: Record<QueryMode, string> = {
  contract: 'I cannot find this in the document.',
  history: 'I cannot find this in our conversation.',
  both: 'I cannot find this in the document or our conversation.',
}

/**
 * Runs one grounded chat turn through the Conversation Memory Layer:
 *   1. CLASSIFY the question (contract / history / both)
 *   2. RETRIEVE the matching context (history window; contract text unless history-only)
 *   3. RESPOND with the system prompt matched to the source
 * Returns the answer text and the source it was drawn from (temp 0.4, max 1000 tokens).
 */
export async function chat({ contractText, history, message }: ChatArgs): Promise<ChatResult> {
  const openai = getOpenAI()
  const mode = classifyQuery(message)

  // RETRIEVE — history-only questions get a larger window (and no contract text);
  // contract/both questions get the shorter window plus the document.
  const window =
    mode === 'history' ? LIMITS.CHAT_HISTORY_ONLY_WINDOW : LIMITS.CHAT_HISTORY_WINDOW
  const historyMessages = history.slice(-window).map((m) => ({
    role: m.role,
    content: m.content,
  }))

  const system = buildChatSystemPrompt(mode, contractText)

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

  const answer = completion.choices[0]?.message?.content?.trim()
  return { answer: answer || FALLBACK[mode], source: mode }
}
