# Spec — Dashboard, Feedback & Delete (US-008/010, FR-10/12)

## Dashboard — `app/dashboard/page.tsx` (Server Component, protected)
**Goal:** show totals, NDA/MSA breakdown, and a sortable list of all the user's contracts; rows open results.

- Data: `GET /api/contracts` (or direct RSC read via `lib/supabase/server.ts`) →
  `{ contracts: Contract[], totals: { total, nda, msa } }`.
  - `total` = count; `nda`/`msa` = counts by `contract_type`. Uses index `(user_id, contract_type)`.
  - List ordered by `created_at desc` (index `(user_id, created_at desc)`); client-side re-sort by name | type | date.
- Components:
  - `SummaryCard` — total processed + NDA/MSA split.
  - `ReviewContractCTA` — prominent "Review a Contract" → `/review`.
  - `ContractTable` — columns: Name, Type, Date, Status (pill: complete=green, processing=amber, error=red), row click → `/contracts/[id]`; sortable headers.
  - Empty state: "No contracts reviewed yet — upload your first contract to begin."
- Design: cards `--radius-card` / `--bg-surface`; status pills use semantic colours; 4px grid.

## Feedback — `POST /api/feedback` (US-010, FR-12) · P2
- `components/contract/FeedbackWidget.tsx` on the results page: thumbs up/down (lucide 18px) + optional comment textarea + submit; disable after submit; success toast.
- Route: `requireAuth()`; validate `feedbackSchema` (`contract_id` uuid, `rating` up|down, `comment?` ≤ 2000); verify contract ownership (RLS); INSERT `user_feedback`; return `201 { feedback: { id } }`.
- Edge cases: double-submit prevented; comment optional; failure → retry.

## Delete contract — `DELETE /api/contracts/[id]` (GDPR / retention)
- Confirmation modal required ("Delete this contract and all its data?").
- Route: `requireAuth()`; load contract (RLS) → `404` if missing; delete Storage object at `file_path` (if set); delete `contracts` row — FK `on delete cascade` removes `key_terms`, `custom_key_terms`, `chat_sessions`, `chat_messages`, `user_feedback`. Return `200 { deleted: true }`.
- UI removes the row from dashboard/results and redirects to `/dashboard`.

## Cross-cutting
- **Not-legal-advice disclaimer** (`NotLegalAdviceBanner`) on every results page; footer "Powered by OpenAI GPT-4o".
- **Retention:** PDFs auto-deleted 90 days after last access (ops/cron concern; `contract_text` persists independently in the DB). Users can delete anytime (above).
- **Calibration warning:** show a UI banner if the monthly calibration eval reports ≥ 15% miscalibration.
