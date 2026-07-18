/**
 * Neutralises prompt-injection attempts in user-supplied text before it reaches
 * the LLM (chat questions + custom term names). We do not reject input — we
 * defang instruction-like patterns so the model treats the content strictly as
 * data. The system prompt remains the sole source of instructions.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore (all |any |the )?(previous|prior|above)( instructions| prompts)?/gi,
  /disregard (all |any |the )?(previous|prior|above)/gi,
  /forget (everything|all|the above|previous)/gi,
  /you are (now |)?(a |an |)(?:different|new)\b/gi,
  /system prompt/gi,
  /\bact as\b/gi,
  /reveal (your |the )?(system |)(prompt|instructions)/gi,
  /override (your |the )?(instructions|rules|guardrails)/gi,
]

// Strip control chars (0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F, 0x7F); preserve
// tab (0x09), newline (0x0A), carriage return (0x0D). Built from a string so no
// raw control bytes appear in source.
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F]',
  'g',
)

export interface SanitizeResult {
  sanitized: string
  flagged: boolean
}

export function sanitizeForLLM(input: string): SanitizeResult {
  let flagged = false
  let sanitized = input

  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      flagged = true
      sanitized = sanitized.replace(pattern, '[removed]')
    }
  }

  sanitized = sanitized.replace(CONTROL_CHARS, '').trim()

  if (flagged) {
    console.warn('[promptInjectionGuard] neutralised suspicious input')
  }
  return { sanitized, flagged }
}
