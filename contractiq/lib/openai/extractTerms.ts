import type { ContractType, ExtractedTerm } from '@/types'
import { getOpenAI, OPENAI_MODEL, OPENAI_USER_TAG, withRetry } from './client'
import { buildExtractionSystemPrompt } from './prompts'

export interface ExtractTermsArgs {
  contractText: string
  contractType: ContractType
  customTerms: string[]
}

/** Parses + validates the model's JSON into clean ExtractedTerm[]. */
function parseTerms(raw: string): ExtractedTerm[] {
  const parsed = JSON.parse(raw) as { terms?: unknown }
  const arr = Array.isArray(parsed.terms) ? parsed.terms : []
  const terms: ExtractedTerm[] = []

  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const t = item as Record<string, unknown>
    const term_name = typeof t.term_name === 'string' ? t.term_name.trim() : ''
    if (!term_name) continue

    const source_sentence = typeof t.source_sentence === 'string' ? t.source_sentence.trim() : ''
    let confidence = typeof t.confidence_score === 'number' ? t.confidence_score : 0
    if (Number.isNaN(confidence)) confidence = 0
    confidence = Math.min(1, Math.max(0, confidence)) // clamp 0..1

    // Grounding rule: a term with no supporting sentence is unreliable.
    if (!source_sentence) confidence = Math.min(confidence, 0.2)

    const pageNum = typeof t.page_number === 'number' ? Math.max(1, Math.floor(t.page_number)) : 1

    terms.push({
      term_name,
      value: typeof t.value === 'string' && t.value.trim() ? t.value.trim() : 'Not found',
      page_number: pageNum,
      confidence_score: confidence,
      source_sentence,
    })
  }
  return terms
}

/**
 * Runs GPT-4o extraction with JSON mode, temp 0.1, and a single JSON-parse retry.
 * Throws on persistent failure (route sets contract status='error').
 */
export async function extractTerms({
  contractText,
  contractType,
  customTerms,
}: ExtractTermsArgs): Promise<ExtractedTerm[]> {
  const openai = getOpenAI()
  const system = buildExtractionSystemPrompt(contractType, customTerms)

  const call = (extraNote?: string) =>
    withRetry(() =>
      openai.chat.completions.create({
        model: OPENAI_MODEL,
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        user: OPENAI_USER_TAG,
        messages: [
          { role: 'system', content: extraNote ? `${system}\n\n${extraNote}` : system },
          { role: 'user', content: contractText },
        ],
      }),
    )

  const first = await call()
  const firstRaw = first.choices[0]?.message?.content ?? ''
  try {
    return parseTerms(firstRaw)
  } catch {
    // Single automatic retry on unparseable JSON.
    const retry = await call('Your previous response was not valid JSON. Return only the JSON object, no explanation.')
    const retryRaw = retry.choices[0]?.message?.content ?? ''
    return parseTerms(retryRaw)
  }
}
