# ContractIQ — Implementation Specs (Stage 2)

Granular, buildable specs derived from `docs/engineering/engineering-doc.md` and `docs/engineering/implementation-specs.md`. Each file is self-contained and runnable where applicable.

| File | What it specifies |
|---|---|
| `supabase-schema.sql` | Paste-and-run Supabase schema — tables, enums, indexes, `updated_at` triggers, RLS (own-data-only), profiles auto-provision, `term_corrections` view, Storage bucket + policies. |
| `../../contractiq/.env.example` | Every environment variable (Supabase, OpenAI, App), grouped by service with `# SERVER ONLY` flags. |
| `api-and-validation-spec.md` | All Route Handler contracts, shared TypeScript types, and Zod validation schemas. |
| `auth-spec.md` | Supabase Auth (email/password), SSR clients, `middleware.ts` route protection, callback route. |
| `upload-and-extraction-spec.md` | `POST /api/contracts/upload` — pdf-parse text extraction with `[PAGE N]`, guards, non-blocking Storage upload. |
| `key-term-extraction-spec.md` | `POST /api/contracts/[id]/process` — GPT-4o extraction, few-shot prompt library, JSON schema, retry, confidence + source sentences. |
| `chat-spec.md` | `POST/GET /api/contracts/[id]/chat` — grounded RAG chat, full-context + full-history, query classification, `[Page X]` citations, persistence. |
| `results-and-viewer-spec.md` | Results page — PDF.js viewer + `[PAGE N]` text fallback, key-terms panel, confidence badge, page navigation, inline edit (`PATCH /api/key-terms/[id]`). |
| `dashboard-and-feedback-spec.md` | Dashboard queries + `GET /api/contracts`, feedback (`POST /api/feedback`), delete (`DELETE /api/contracts/[id]`). |

## Setup order
1. Run `supabase-schema.sql` in the Supabase SQL Editor (fresh project).
2. `cp contractiq/.env.example contractiq/.env.local` and fill values.
3. Stage 3 (`/security-foundation`) adds `lib/security/*`, `supabase/rls-policies.sql` (incl. `rate_limit_events`).
4. Stage 5 builds features per these specs.

## Conventions (all specs)
- TypeScript · Next.js App Router Route Handlers · `@supabase/ssr`.
- Auth required on every route; RLS `auth.uid() = user_id` is the authoritative isolation layer.
- Zod on every request body/param. Error envelope: `{ "error": { "code": string, "message": string } }`.
- Design tokens from `docs/design.md` (apply `/design-system` to all UI).
- Security helpers (`requireAuth`, `rateLimiter`, `sanitizeForLLM`, `validateFileUpload`) are Stage 3 deliverables; specs reference them by name.
