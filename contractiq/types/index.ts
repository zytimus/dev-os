// Shared domain types for ContractIQ. Mirrors the Supabase schema (docs/specs/supabase-schema.sql).

export type ContractType = 'nda' | 'msa'
export type ContractStatus = 'uploaded' | 'processing' | 'complete' | 'error'
export type MessageRole = 'user' | 'assistant'
export type FeedbackRating = 'up' | 'down'

/**
 * Where an assistant answer was sourced from (the Conversation Memory Layer).
 * - `contract` — answered from the document text
 * - `history`  — answered from the conversation history only
 * - `both`     — answered from the document and the conversation
 */
export type QueryMode = 'contract' | 'history' | 'both'

export interface Contract {
  id: string
  user_id: string
  filename: string
  contract_type: ContractType
  file_path: string | null
  contract_text: string
  page_count: number
  token_count: number
  status: ContractStatus
  created_at: string
  updated_at: string
}

/** Dashboard/list projection — omits the heavy contract_text field. */
export type ContractSummary = Omit<Contract, 'contract_text'>

export interface KeyTerm {
  id: string
  contract_id: string
  user_id: string
  term_name: string
  value: string
  page_number: number | null
  confidence_score: number | null // 0..1
  source_sentence: string | null
  is_custom: boolean
  original_ai_value: string | null
  is_edited: boolean
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  user_id: string
  role: MessageRole
  content: string
  page_citation: number | null
  /** Source attribution for assistant answers; null for user turns and legacy rows. */
  source: QueryMode | null
  created_at: string
}

export interface UserFeedback {
  id: string
  contract_id: string
  user_id: string
  rating: FeedbackRating
  comment: string | null
  created_at: string
}

/** The exact object shape GPT-4o must return per extracted term. */
export interface ExtractedTerm {
  term_name: string
  value: string
  page_number: number
  confidence_score: number // 0..1
  source_sentence: string
}

export interface ContractTotals {
  total: number
  nda: number
  msa: number
}

/** Standard API error envelope. */
export interface ApiError {
  error: { code: string; message: string }
}
