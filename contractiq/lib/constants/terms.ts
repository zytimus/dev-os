import type { ContractType } from '@/types'

/** Standard key-term sets per contract type (docs/specs/key-term-extraction-spec.md). */
export const STANDARD_TERMS: Record<ContractType, string[]> = {
  nda: [
    'Parties',
    'Effective Date',
    'Confidentiality Obligations',
    'Permitted Disclosures',
    'Term & Duration',
    'Governing Law',
    'Jurisdiction',
    'IP Ownership',
    'Non-Solicitation',
    'Breach & Remedy',
  ],
  msa: [
    'Parties',
    'Service Scope',
    'Payment Terms',
    'Invoice Schedule',
    'Late Payment Penalty',
    'Liability Cap',
    'Indemnification',
    'IP Ownership',
    'Termination Clause',
    'Governing Law',
    'Dispute Resolution',
    'Notice Period',
  ],
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  nda: 'NDA',
  msa: 'MSA',
}

/** Upload / processing limits (docs constraints §5). */
export const LIMITS = {
  MAX_FILE_BYTES: 10 * 1024 * 1024, // 10 MB
  MAX_PAGES: 20,
  MAX_TOKENS: 15000,
  MIN_WORDS: 100, // below this => treated as scanned PDF
  MAX_CUSTOM_TERMS: 5,
  MAX_MESSAGE_CHARS: 2000,
  MAX_HISTORY_MESSAGES: 200,
  // Conversation Memory Layer retrieval windows (most-recent messages sent to the model).
  CHAT_HISTORY_WINDOW: 10, // contract / both questions: contract text + last 10 turns
  CHAT_HISTORY_ONLY_WINDOW: 20, // history questions: conversation only, up to 20 turns
  SIGNED_URL_TTL_SECONDS: 3600, // 1 hour
} as const

export const STORAGE_BUCKET = 'contracts'
