import type { ContractType, QueryMode } from '@/types'
import { STANDARD_TERMS, CONTRACT_TYPE_LABELS } from '@/lib/constants/terms'

/** Versioned prompt library. Bump on any change and re-run the offline eval. */
export const PROMPT_VERSION = 'v1.0'

const FEW_SHOT = `
Examples (input snippet -> expected JSON term):

NDA #1:
"[PAGE 2] This Agreement is entered into by Acme Corp and Beta LLC." ->
{ "term_name": "Parties", "value": "Acme Corp and Beta LLC", "page_number": 2, "confidence_score": 0.95, "source_sentence": "This Agreement is entered into by Acme Corp and Beta LLC." }

NDA #2:
"[PAGE 3] The obligations of confidentiality shall survive for a period of three (3) years." ->
{ "term_name": "Term & Duration", "value": "3 years", "page_number": 3, "confidence_score": 0.9, "source_sentence": "The obligations of confidentiality shall survive for a period of three (3) years." }

NDA #3:
"[PAGE 5] This Agreement shall be governed by the laws of the State of Delaware." ->
{ "term_name": "Governing Law", "value": "State of Delaware", "page_number": 5, "confidence_score": 0.93, "source_sentence": "This Agreement shall be governed by the laws of the State of Delaware." }

MSA #1:
"[PAGE 1] Client shall pay Provider within thirty (30) days of invoice." ->
{ "term_name": "Payment Terms", "value": "Net 30 days", "page_number": 1, "confidence_score": 0.92, "source_sentence": "Client shall pay Provider within thirty (30) days of invoice." }

MSA #2:
"[PAGE 4] In no event shall total liability exceed the fees paid in the preceding 12 months." ->
{ "term_name": "Liability Cap", "value": "Fees paid in preceding 12 months", "page_number": 4, "confidence_score": 0.88, "source_sentence": "In no event shall total liability exceed the fees paid in the preceding 12 months." }

MSA #3:
"[PAGE 6] Either party may terminate this Agreement with sixty (60) days written notice." ->
{ "term_name": "Notice Period", "value": "60 days written notice", "page_number": 6, "confidence_score": 0.9, "source_sentence": "Either party may terminate this Agreement with sixty (60) days written notice." }
`.trim()

/** Builds the extraction system prompt for a contract type + custom terms. */
export function buildExtractionSystemPrompt(
  contractType: ContractType,
  customTerms: string[],
): string {
  const standard = STANDARD_TERMS[contractType]
  const targets = [...standard, ...customTerms]

  return `You are ContractIQ, a contract-analysis assistant specialised in ${CONTRACT_TYPE_LABELS[contractType]} agreements.
Extract the requested key terms from the contract text provided by the user. The text contains [PAGE N] markers indicating page boundaries.

Rules:
- Return ONLY a JSON object of the form: { "terms": [ { "term_name", "value", "page_number", "confidence_score", "source_sentence" } ] }.
- Produce exactly one object per requested term, in the order listed.
- page_number is 1-indexed, taken from the nearest preceding [PAGE N] marker for the source sentence.
- confidence_score is a number from 0.0 to 1.0 reflecting your honest certainty.
- source_sentence is the verbatim sentence from the contract that the value was drawn from.
- If a term is genuinely absent, return value "Not found", confidence_score 0.1, and source_sentence "".
- Never invent values. Do not use general legal knowledge. Base every value only on the provided text.

Requested terms (${targets.length}): ${targets.map((t) => `"${t}"`).join(', ')}

${FEW_SHOT}`
}

/**
 * Builds the grounded chat system prompt for the Conversation Memory Layer.
 * The prompt is matched to the classified source so the assistant answers from —
 * and attributes to — the right place.
 */
export function buildChatSystemPrompt(mode: QueryMode, contractText: string): string {
  const preamble =
    'You are ContractIQ, a contract Q&A assistant. Do not use general legal knowledge and do not provide legal advice.'

  const documentBlock = `

DOCUMENT (with [PAGE N] markers):
"""
${contractText}
"""`

  // HISTORY — answer from the conversation only; the contract text is NOT sent.
  // IMPORTANT: do not frame this as a "contract Q&A assistant" and do not hand the
  // model a verbatim "I cannot find this" refusal template. Both prime the model to
  // refuse the moment the document is absent — even when the answer is plainly in the
  // conversation (verified against gpt-4o). Frame it purely as conversation recall.
  if (mode === 'history') {
    return `You are a helpful conversational assistant. The user is asking about this conversation itself — what has been said so far — not about any external document. Answer using only the messages already in this conversation; you may quote or summarise earlier messages, including your own previous answers. If something was never mentioned anywhere in this conversation, say briefly that it did not come up. Do not provide legal advice. End every answer with the exact tag [From conversation].`
  }

  // BOTH — answer from the document and the conversation, attributing each fact.
  if (mode === 'both') {
    return `${preamble}
- Answer from BOTH the contract document and the conversation history provided.
- Attribute EACH fact to its source: cite facts from the contract as [Page X] and facts from the conversation as [From conversation].
- If neither source contains the answer, reply exactly: "I cannot find this in the document or our conversation."${documentBlock}`
  }

  // CONTRACT — answer strictly from the document.
  return `${preamble}
- Answer ONLY from the contract document text provided. If the answer is not in the document, reply exactly: "I cannot find this in the document."
- Begin every answer with "Based on the document, ".
- End every answer with a citation of the form [Page X] pointing to the page the answer is on.${documentBlock}`
}
