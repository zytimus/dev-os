# Spec — API Contracts, Shared Types & Validation

**Scope:** every Next.js Route Handler under `app/api/*`, the shared TypeScript types they exchange, and the Zod schemas that validate input. Companion to the per-feature specs.

## Shared conventions
- **Auth:** every route calls `requireAuth()` (Stage 3, `lib/security/authGuard.ts`) → returns `{ user, supabase }` or throws → 401. RLS enforces isolation even if a check is missed.
- **Validation:** parse body/params with Zod (`lib/validation/schemas.ts`); on failure return `400 validation_error`.
- **Error envelope:** `{ "error": { "code": string, "message": string } }`.
- **Standard codes:** `unauthorized` (401), `validation_error` (400), `not_found` (404), `rate_limited` (429), `openai_error` (502), `internal_error` (500).
- **Rate limiting:** `rateLimiter` (Stage 3) wraps `upload`, `process`, `chat`.

## Shared TypeScript types — `types/index.ts`
```ts
export type ContractType = 'nda' | 'msa';
export type ContractStatus = 'uploaded' | 'processing' | 'complete' | 'error';
export type MessageRole = 'user' | 'assistant';
export type FeedbackRating = 'up' | 'down';

export interface Contract {
  id: string;
  user_id: string;
  filename: string;
  contract_type: ContractType;
  file_path: string | null;
  page_count: number;
  token_count: number;
  status: ContractStatus;
  created_at: string;
  updated_at: string;
}

export interface KeyTerm {
  id: string;
  contract_id: string;
  user_id: string;
  term_name: string;
  value: string;
  page_number: number | null;
  confidence_score: number | null; // 0..1
  source_sentence: string | null;
  is_custom: boolean;
  original_ai_value: string | null;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: MessageRole;
  content: string;
  page_citation: number | null;
  created_at: string;
}

// The exact object shape GPT-4o must return per extracted term.
export interface ExtractedTerm {
  term_name: string;
  value: string;
  page_number: number;
  confidence_score: number; // 0..1
  source_sentence: string;
}
```

## Zod schemas — `lib/validation/schemas.ts`
```ts
import { z } from 'zod';

export const contractTypeSchema = z.enum(['nda', 'msa']);

// upload: file validated separately by validateFileUpload() (Stage 3); form field:
export const uploadFieldsSchema = z.object({
  contract_type: contractTypeSchema,
});

export const processSchema = z.object({
  custom_terms: z.array(z.string().trim().min(1).max(80)).max(5).optional().default([]),
});

export const keyTermEditSchema = z.object({
  value: z.string().trim().min(1).max(2000),
});

export const chatMessageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

export const feedbackSchema = z.object({
  contract_id: z.string().uuid(),
  rating: z.enum(['up', 'down']),
  comment: z.string().trim().max(2000).optional(),
});
```

## Endpoint contracts

### `POST /api/contracts/upload` — see `upload-and-extraction-spec.md`
- Body: `multipart/form-data` → `file` (PDF), `contract_type`.
- 201 → `{ contract: Contract }`.
- Errors: `invalid_file | file_too_large | too_many_pages | scanned_pdf | contract_too_long` (400), `rate_limited`, `internal_error`.

### `POST /api/contracts/[id]/process` — see `key-term-extraction-spec.md`
- Body: `{ custom_terms?: string[] }` (≤5).
- 200 → `{ contract_id: string, status: 'complete', key_terms: KeyTerm[] }`.
- Errors: `too_many_custom_terms` (400), `not_found`, `rate_limited`, `openai_error`.

### `GET /api/contracts`
- 200 → `{ contracts: Contract[], totals: { total: number, nda: number, msa: number } }`.

### `GET /api/contracts/[id]`
- 200 → `{ contract: Contract, key_terms: KeyTerm[], signed_url: string | null }` (1-hour signed URL when `file_path` present).
- Errors: `not_found`.

### `PATCH /api/key-terms/[id]` — see `results-and-viewer-spec.md`
- Body: `{ value: string }`.
- 200 → `{ key_term: KeyTerm }`. Errors: `validation_error`, `not_found`.

### `POST /api/contracts/[id]/chat` — see `chat-spec.md`
- Body: `{ message: string }`.
- 200 → `{ message: ChatMessage }` (assistant). Errors: `message_too_long`, `not_found`, `rate_limited`, `openai_error`.

### `GET /api/contracts/[id]/chat`
- 200 → `{ session_id: string | null, messages: ChatMessage[] }` (ascending, ≤200).

### `POST /api/feedback` — see `dashboard-and-feedback-spec.md`
- Body: `{ contract_id, rating, comment? }`. 201 → `{ feedback: { id: string } }`.

### `DELETE /api/contracts/[id]`
- Cascades DB rows (FK `on delete cascade`) + removes Storage object. 200 → `{ deleted: true }`. Errors: `not_found`.

### `POST /api/auth/login` · `POST /api/auth/logout` — Stage 3 deliverables (server cookie handling).
