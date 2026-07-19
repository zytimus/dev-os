# Spec — PDF Upload & Text Extraction (US-002, FR-02, FR-03)

**Goal:** accept a text-layer PDF (≤ 10 MB, ≤ 20 pages, ≤ 15,000 tokens), extract text **once** with `[PAGE N]` markers, store it as the source of truth, and (non-blocking) upload the file to Storage for the viewer.

## Route — `app/api/contracts/upload/route.ts` (POST)
Steps:
1. `requireAuth()` → `{ user, supabase }`.
2. `rateLimiter` check (Stage 3).
3. Parse `multipart/form-data`: `file` (Blob), `contract_type`. Validate fields with `uploadFieldsSchema`; validate file with `validateFileUpload()` (Stage 3): MIME `application/pdf`, size ≤ 10 MB → else `invalid_file` / `file_too_large`.
4. `extractText(buffer)` (see below) → `{ text, pageCount, tokenCount, wordCount }`.
5. Guards:
   - `wordCount < 100` → `400 scanned_pdf` ("Scanned PDFs are not supported yet").
   - `pageCount > 20` → `400 too_many_pages`.
   - `tokenCount > 15000` → `400 contract_too_long`.
6. INSERT `contracts` (`status='uploaded'`, `contract_text=text`, `page_count`, `token_count`, `file_path=null`, `filename`, `contract_type`, `user_id`).
7. **Non-blocking Storage upload** (`lib/supabase/storage.ts`): upload buffer to `contracts/{user_id}/{contract_id}/{filename}.pdf`. On success → UPDATE `file_path`; on failure → log + leave `file_path=null` (do NOT fail the request — the text pipeline is unaffected; viewer will use the text fallback).
8. Return `201 { contract }`.

## Text extraction — `lib/pdf/extractText.ts`
- Use `pdf-parse`. Render per page and prefix each page's text with a marker: `"[PAGE 1]\n<page 1 text>\n[PAGE 2]\n<page 2 text>..."` (1-indexed). Pages are the unit for page attribution + the text-viewer fallback.
- `pageCount` from the parsed PDF metadata; `wordCount` = whitespace-split length of extracted text.
- `tokenCount` ≈ estimate (e.g. `Math.ceil(chars / 4)`) or a tokenizer; used only for the ≤15k guard and cost logging.
- Returns `{ text, pageCount, tokenCount, wordCount }`. Pure/unit-testable.

```ts
export interface ExtractResult { text: string; pageCount: number; tokenCount: number; wordCount: number; }
export async function extractText(buffer: Buffer): Promise<ExtractResult> { /* pdf-parse + [PAGE N] markers */ }
```

## Storage helper — `lib/supabase/storage.ts`
- `uploadContractPdf(userId, contractId, filename, buffer)` → uploads to the `contracts` bucket at the path above; returns the object path or throws (caller swallows).
- `getSignedUrl(path, expiresInSeconds = 3600)` → 1-hour signed URL for the viewer (used by `GET /api/contracts/[id]`).

## Client — `app/review/page.tsx` + `components/review/*`
- `ContractTypeSelect` (NDA | MSA) — required before upload.
- `PdfDropzone` — drag/drop or file-pick; **client pre-check** of MIME + ≤10 MB before sending; shows progress; renders specific server error messages.
- On success, store the returned `contract` in page state and render `KeyTermPreview` (standard terms for the type + custom-term input) — see `key-term-extraction-spec.md`.

## Edge cases
- Scanned/image PDF (<100 words) → "Scanned PDFs are not supported yet".
- Oversize / too many pages / too long → specific 400 messages.
- Corrupted/unparseable PDF → graceful `400 invalid_file`, no partial row persisted.
- Storage down → `file_path=null`, upload still succeeds; results page falls back to the text viewer.
- Duplicate uploads allowed (each is a new contract row).
