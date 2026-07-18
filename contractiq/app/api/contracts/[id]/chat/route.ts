import { handleRoute, apiJson, HttpError } from '@/lib/utils/api'
import { requireAuth } from '@/lib/security/authGuard'
import { enforceRateLimit, RATE_LIMITS } from '@/lib/security/rateLimiter'
import { requireOwnedContract } from '@/lib/security/chatSecurity'
import { sanitizeForLLM } from '@/lib/security/promptInjectionGuard'
import { capHistory } from '@/lib/security/tokenLimiter'
import { chat, parsePageCitation } from '@/lib/openai/chat'
import { chatMessageSchema } from '@/lib/validation/schemas'
import { LIMITS } from '@/lib/constants/terms'
import type { ChatMessage } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

type RouteContext = { params: { id: string } }

/** GET — load persisted chat history (ascending, ≤200). */
export const GET = handleRoute(async (_req, { params }: RouteContext) => {
  const { user, supabase } = await requireAuth()
  await requireOwnedContract(supabase, params.id, user.id)

  const { data: session } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', params.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!session) {
    return apiJson({ session_id: null, messages: [] as ChatMessage[] })
  }

  const { data: messages } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', session.id)
    .order('created_at', { ascending: true })
    .limit(LIMITS.MAX_HISTORY_MESSAGES)

  return apiJson({
    session_id: session.id,
    messages: (messages ?? []) as ChatMessage[],
  })
})

/** POST — ask a question grounded strictly in the contract text. */
export const POST = handleRoute(async (req, { params }: RouteContext) => {
  const { user, supabase } = await requireAuth()
  await enforceRateLimit(user.id, 'chat', RATE_LIMITS.chat.limit, RATE_LIMITS.chat.windowSeconds)

  const contract = await requireOwnedContract(supabase, params.id, user.id)

  const body = await req.json().catch(() => null)
  const { message } = chatMessageSchema.parse(body)
  const { sanitized } = sanitizeForLLM(message)

  // Get-or-create the chat session for this contract.
  let sessionId: string
  const { data: existing } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('contract_id', contract.id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    sessionId = existing.id
  } else {
    const { data: created, error: createError } = await supabase
      .from('chat_sessions')
      .insert({ contract_id: contract.id, user_id: user.id })
      .select('id')
      .single()
    if (createError || !created) {
      throw new Error(`Failed to create chat session: ${createError?.message}`)
    }
    sessionId = created.id
  }

  // CRITICAL: load the full conversation history BEFORE saving the new user
  // message. If we saved first, the classifier would see the current question as
  // part of history and always misclassify the context. Cap to the token-safe window.
  const { data: historyRows } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
    .limit(LIMITS.MAX_HISTORY_MESSAGES)

  const history = capHistory((historyRows ?? []) as ChatMessage[])

  let answer: string
  let source: ChatMessage['source']
  try {
    const result = await chat({
      contractText: contract.contract_text,
      history,
      message: sanitized,
    })
    answer = result.answer
    source = result.source
  } catch (err) {
    console.error('[chat] OpenAI failure:', err)
    throw new HttpError(502, 'openai_error', 'The assistant is unavailable right now. Please try again.')
  }

  const pageCitation = parsePageCitation(answer)

  // Persist the user turn, then the assistant turn.
  const { error: userInsertError } = await supabase.from('chat_messages').insert({
    session_id: sessionId,
    user_id: user.id,
    role: 'user',
    content: sanitized,
    page_citation: null,
    source: null,
  })
  if (userInsertError) {
    throw new Error(`Failed to save message: ${userInsertError.message}`)
  }

  const { data: assistantMessage, error: assistantInsertError } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      user_id: user.id,
      role: 'assistant',
      content: answer,
      page_citation: pageCitation,
      source,
    })
    .select('*')
    .single()

  if (assistantInsertError || !assistantMessage) {
    throw new Error(`Failed to save reply: ${assistantInsertError?.message}`)
  }

  return apiJson({ message: assistantMessage as ChatMessage })
})
