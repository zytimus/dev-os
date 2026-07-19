# Spec — Key Term Extraction (US-002/004/005, FR-04/05/11)

**Goal:** run GPT-4o over the stored contract text to extract standard + custom terms as structured JSON — each with value, 1-indexed page number, confidence (0–1), and verbatim source sentence. Persist to `key_terms`. Target ≤ 30 s P95, ≤ $0.20 / analysis.

## Route — `app/api/contracts/[id]/process/route.ts` (POST)
1. `requireAuth()` + `rateLimiter`.
2. Load contract (RLS-scoped `select ... eq('id', id)`); if none → `404 not_found`.
3. Validate body with `processSchema` (`custom_terms` ≤ 5, else `400 too_many_custom_terms`). `sanitizeForLLM()` each custom term name (Stage 3).
4. UPDATE `status='processing'`.
5. INSERT any `custom_key_terms` rows (`is_manual=true`).
6. `extractTerms({ contractText, contractType, customTerms })` (below) → `ExtractedTerm[]`.
7. INSERT `key_terms` (map each: `is_custom` = term_name ∈ customTerms). Use the admin/service client for the write, still scoped to `user_id`.
8. UPDATE `status='complete'`. Return `200 { contract_id, status, key_terms }`.
9. On OpenAI failure after retries → UPDATE `status='error'`, return `502 openai_error` (user retries without re-upload).

## OpenAI orchestration — `lib/openai/`
- `client.ts` — OpenAI SDK client from `OPENAI_API_KEY`; model from `OPENAI_MODEL` (default `gpt-4o`); pass `user: OPENAI_USER_TAG`.
- `extractTerms.ts` — builds messages, calls chat completions with:
  - `response_format: { type: 'json_object' }`
  - `temperature: 0.1`, `max_tokens: 2000`
  - **3× retry with exponential backoff** on transient errors (429/5xx/network).
  - **JSON parse recovery:** if the response isn't valid JSON matching the schema, send **one** retry message: *"Your previous response was not valid JSON. Return only the JSON array, no explanation."* On second failure → throw (route sets `status='error'`).
  - Validate each parsed term against `ExtractedTerm` (clamp `confidence_score` to 0–1; drop terms missing `source_sentence` per grounding rule).
- `prompts.ts` — the versioned prompt library (below).

## Standard term sets (by contract type)
- **NDA:** Parties, Effective Date, Confidentiality Obligations, Permitted Disclosures, Term & Duration, Governing Law, Jurisdiction, IP Ownership, Non-Solicitation, Breach & Remedy.
- **MSA:** Parties, Service Scope, Payment Terms, Invoice Schedule, Late Payment Penalty, Liability Cap, Indemnification, IP Ownership, Termination Clause, Governing Law, Dispute Resolution, Notice Period.
- **Custom terms:** appended (zero-shot) to the target list; same output schema; flagged `is_custom`.

## Prompt (system) — shape in `prompts.ts`
```
You are ContractIQ, a contract-analysis assistant. Extract the requested key terms from the
contract text below. The text contains [PAGE N] markers indicating page boundaries.

Rules:
- Return ONLY a JSON object: { "terms": ExtractedTerm[] }.
- For each requested term produce: term_name, value, page_number (1-indexed, from the nearest
  preceding [PAGE N] marker), confidence_score (0.0–1.0, your honest certainty), and
  source_sentence (the verbatim sentence the value came from).
- If a term is genuinely absent, return it with value "Not found", confidence_score <= 0.2,
  and source_sentence "".
- Never invent values. confidence_score must reflect real uncertainty.

Requested terms: <standard set for {contract_type}> + <custom terms>

<3 few-shot NDA examples + 3 few-shot MSA examples: input snippet → expected JSON>
```
User message = the full `contract_text`. **Few-shot examples** (3 NDA + 3 MSA) are embedded in the system prompt to lock the schema and handle clause-variant diversity. Maintain a versioned library (v1.0, v1.1…) for the monthly A/B eval.

## Output schema (per term)
```json
{ "term_name": "Governing Law", "value": "State of Delaware", "page_number": 4,
  "confidence_score": 0.91, "source_sentence": "This Agreement shall be governed by the laws of the State of Delaware." }
```

## Client — processing UX
- `ProgressStepper` shows 3 steps (extracting text → analysing with AI → compiling results) mapped to the request lifecycle; on `complete` navigate to `/contracts/[id]`.

## Edge cases
- >5 custom terms → `too_many_custom_terms` (also blocked client-side).
- Invalid JSON twice → `status='error'` + retriable.
- Non-contract document → model returns low-confidence / "Not found" terms (never fabricate).
- Missing `source_sentence` → term treated as unreliable (dropped or forced low confidence).
- Cost/latency: keep within ≤ $0.20 and ≤ 30 s P95; log token usage.
