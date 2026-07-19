# ContractIQ — Implementation Specs (Per-Feature)

**Status:** Draft for approval (Stage 1)
**Companion to:** `docs/engineering/engineering-doc.md`
**Source PRD:** `docs/ContractIQ_PRD.md` · **Design:** `docs/design.md`

> One spec block per MVP feature. Each block: **User flow · DB schema touched · DB tasks · API routes · State management · Component spec · Design · Edge cases**. These blocks are the bridge from the high-level engineering doc to Stage 2 (`implementation-specs` → SQL + `.env.example` + granular specs) and Stage 5 (feature build). All UI references `docs/design.md` tokens; apply `/design-system` to every component.

**Shared conventions (apply to all blocks):**
- Language: TypeScript. Backend: Next.js Route Handlers. Auth: Supabase session on every route; RLS `auth.uid() = user_id`.
- Validation: Zod on all request bodies/params. Error envelope: `{ error: { code, message } }`.
- Colours: Primary `#115ACB`; text `#070A0E`/`#4A4C4F`; surface `#FAFAFA`; confidence green `#13A10E` / amber `#FFAA33` / red `#D13438`. Type: Inter Display. Grid: 4px. Icons: lucide-react 18px/1.5.

---

## Spec 1 — Authentication (US-001, FR-01) · P0

**User flow:** Visitor → `/signup` (email+password) → Supabase `signUp` → email verification → `/auth/callback` → `/dashboard`. Returning: `/login` → `signInWithPassword` → session cookie → `/dashboard`. Sign out clears session. Unauthenticated access to protected routes → redirect `/login`.

**DB schema touched:** `profiles` (auto-created via `on_auth_user_created` trigger mirroring `auth.users`).

**DB tasks:** Trigger + function to insert `profiles` row on new `auth.users`. RLS: user selects/updates own profile.

**API routes:** Sign-up + session reads via Supabase client. `POST /api/auth/login`, `POST /api/auth/logout` (server cookie handling) — **delivered by Stage 3**. `GET /app/auth/callback/route.ts` exchanges the verification code for a session.

**State management:** Session via `@supabase/ssr` cookies; `middleware.ts` checks session for protected routes. Auth form uses local `useState`.

**Component spec:** `AuthForm` (email, password, submit; loading + inline error). Reused on `/login` and `/signup`. Primary button `#115ACB`, 6px radius, 150ms ease-out.

**Design:** Centered card (8px radius, surface `#FAFAFA`), Inter Display, 16px inputs on 4px grid, error text in `#D13438`.

**Edge cases:** invalid credentials → clear inline error; unverified email → prompt to verify; auth must complete ≤ 10 s; duplicate email on signup → friendly message; expired session → redirect to `/login`.

---

## Spec 2 — PDF Upload & Text Extraction (US-002, FR-02, FR-03) · P0

**User flow:** `/review` → select type (NDA/MSA) → drag/drop or pick PDF → client pre-check (type + ≤ 10 MB) → `POST /api/contracts/upload` → server extracts text → pre-processing preview shown.

**DB schema touched:** `contracts` (INSERT: filename, contract_type, contract_text, page_count, token_count, status='uploaded', file_path|null).

**DB tasks:** INSERT contract; indexes `(user_id, created_at desc)`, `(user_id, contract_type)`. RLS own-data-only.

**API routes:** `POST /api/contracts/upload` (multipart: `file`, `contract_type`). Steps: Zod + `validateFileUpload()` → `lib/pdf/extractText.ts` (pdf-parse, insert `[PAGE N]`, count pages/tokens) → guard (<100 words → `scanned_pdf`; >20 pp → `too_many_pages`; >15k tokens → `contract_too_long`) → INSERT → non-blocking `lib/supabase/storage.ts` upload to `contracts/{uid}/{cid}/{file}.pdf` (set `file_path` or null).

**State management:** `PdfDropzone` local state (file, progress, error); on success store returned contract in page state to drive the preview.

**Component spec:** `ContractTypeSelect` (NDA|MSA), `PdfDropzone` (drag active state, file chip, size/type errors), upload progress bar.

**Design:** dashed dropzone, 8px radius, hover border `#115ACB`; success chip; error banner `#D13438`.

**Edge cases:** scanned PDF (<100 words) → "Scanned PDFs are not supported yet"; oversize/too-many-pages/too-long → specific messages; corrupted PDF → graceful error, no partial row; **Storage failure → `file_path=null`, upload still succeeds, viewer falls back to text** (AI pipeline unaffected).

---

## Spec 3 — Key Term Extraction (US-002, FR-04) · P0

**User flow:** Preview → click "Process Contract" → 3-step progress (extract → analyse → compile) → results.

**DB schema touched:** `contracts` (status → processing → complete|error), `key_terms` (INSERT rows), `custom_key_terms` (INSERT requested terms).

**DB tasks:** UPDATE status; INSERT key_terms (term_name, value, page_number, confidence_score, source_sentence, is_custom). Index `(contract_id)`.

**API routes:** `POST /api/contracts/[id]/process` `{ custom_terms?: string[] (≤5) }`. Steps: ownership check → status='processing' → persist custom terms → `lib/openai/extractTerms.ts` builds few-shot prompt (3 NDA + 3 MSA examples; standard term set by type + custom terms) → GPT-4o JSON mode, temp 0.1, max 2000 out → parse; on invalid JSON one retry ("Return only the JSON array…") → INSERT key_terms → status='complete'. On OpenAI failure after 3× backoff → status='error', `502`.

**State management:** `ProgressStepper` reflects request lifecycle; on completion navigate to `/contracts/[id]`.

**Component spec:** `ProgressStepper` (3 labelled steps with active/complete states).

**Design:** stepper with `#115ACB` active, `#13A10E` complete; motion 150ms.

**Edge cases:** invalid JSON twice → error + retriable (status='error', no re-upload); >5 custom terms → `too_many_custom_terms`; non-contract doc → extracts what it can, low confidence expected; must hit ≤ 30 s P95 / ≤ $0.20 cost.

---

## Spec 4 — Confidence Display (US-004, FR-11) · P0

**User flow:** Results panel shows a colour-coded confidence per term; < 50% shows a warning and recommendation.

**DB schema touched:** reads `key_terms.confidence_score` (0.000–1.000).

**DB tasks:** none (read).

**API routes:** none (data via `GET /api/contracts/[id]`).

**State management:** derived from term data; no extra state.

**Component spec:** `ConfidenceBadge` — maps score to colour + label: ≥ 0.80 green `#13A10E`, 0.50–0.79 amber `#FFAA33`, < 0.50 red `#D13438` with ⚠️ icon + **non-dismissible** tooltip "Low confidence — we recommend verifying this in the document directly." Term is **never hidden**.

**Design:** tag radius 4px; icon+colour (not colour alone) for a11y; tooltip on hover/focus, keyboard-accessible.

**Edge cases:** missing/out-of-range score → treat as low confidence; calibration warning banner shown if monthly eval reveals ≥ 15% miscalibration.

---

## Spec 5 — Page Attribution (US-003, FR-07) · P0/P1

**User flow:** Each term shows a page number; clicking it scrolls the viewer to that page with a highlight.

**DB schema touched:** reads `key_terms.page_number` (1-indexed).

**DB tasks:** none.

**API routes:** none (uses loaded data).

**State management:** results page holds `targetPage` state; clicking a term's page sets it; viewer components react to `targetPage` prop changes.

**Component spec:** `PageLink` in `KeyTermRow` → sets `targetPage`. Both `PdfViewer` and `TextViewerFallback` accept `targetPage` and smooth-scroll + highlight the referenced paragraph/page.

**Design:** page link in `#115ACB`; highlight uses subtle `#F0F0F1` / brand tint; smooth scroll (250ms).

**Edge cases:** page number beyond rendered range → clamp + toast; low-confidence term auto-highlights nearest matching span.

---

## Spec 6 — Custom Key Terms (US-005, FR-05) · P0

**User flow:** In the pre-processing preview, "+ Add Key Term" lets the user add up to 5 custom terms; they appear with a "Custom" badge and are extracted with the same schema.

**DB schema touched:** `custom_key_terms` (INSERT is_manual=true), results in `key_terms` (is_custom=true).

**DB tasks:** INSERT custom terms; enforce ≤ 5 at app layer.

**API routes:** carried in `POST /api/contracts/[id]/process` `custom_terms[]`.

**State management:** `CustomTermInput` local list (add/remove), max 5, passed to process request.

**Component spec:** `CustomTermInput` (text field + add button, chip list with remove, "Custom" badge), integrated into `KeyTermPreview`.

**Design:** chips 4px radius; "Custom" badge in accent `#7F00FF`; disabled add at 5 with helper text.

**Edge cases:** >5 blocked client-side and server-side (`too_many_custom_terms`); empty/duplicate term name rejected; custom terms sanitised for prompt injection before reaching the model.

---

## Spec 7 — PDF Viewer & Text Fallback (US-006, FR-06) · P1

**User flow:** Results left panel renders the PDF interactively; if Storage is unavailable, a paginated text viewer renders instead. Both support page navigation from term clicks.

**DB schema touched:** reads `contracts.file_path` and `contracts.contract_text`.

**DB tasks:** none.

**API routes:** `GET /api/contracts/[id]` returns a 1-hour signed URL when `file_path` present, else null.

**State management:** results page decides viewer variant from `signed_url` presence; both accept `targetPage`.

**Component spec:** `PdfViewer` (PDF.js/`pdfjs-dist`: render all pages, scroll, zoom in/out, lazy page load, highlight, `targetPage`). `TextViewerFallback` (parses `[PAGE N]` markers → labelled page sections, same scroll-to-page behaviour, "download PDF" link if available).

**Design:** viewer surface `#FFFFFF`; page labels in `#4A4C4F`; zoom controls as `ui/Button`.

**Edge cases:** signed URL expired/`file_path` null → text fallback; complex fonts fail to render → download link; large PDF memory → lazy-load pages, recommend desktop.

---

## Spec 8 — Inline Term Editing (US-009) · P1

**User flow:** Click a term's value → inline edit → save → "Edited" badge; original AI value preserved.

**DB schema touched:** `key_terms` (UPDATE value, is_edited=true; set original_ai_value on first edit).

**DB tasks:** UPDATE with first-edit guard (copy value → original_ai_value only if null); `updated_at` trigger. Feeds `term_corrections` view.

**API routes:** `PATCH /api/key-terms/[id]` `{ value }` — ownership check, ≤ 2 s target.

**State management:** `KeyTermRow` local edit mode; optimistic update with rollback on error.

**Component spec:** editable value with save/cancel; `EditedBadge` when `is_edited`.

**Design:** inline input 6px radius; "Edited" badge subtle grey `#F0F0F1`; save confirm toast.

**Edge cases:** empty value rejected (`validation_error`); save failure → rollback + error; original_ai_value never overwritten on subsequent edits.

---

## Spec 9 — Chat with Contract (US-007, FR-08) · P1

**User flow:** Results → Chat tab → type question → grounded answer with `[Page X]` → clicking citation scrolls viewer.

**DB schema touched:** `chat_sessions` (get-or-create), `chat_messages` (INSERT user + assistant).

**DB tasks:** get-or-create session; INSERT messages; index `(session_id, created_at asc)`.

**API routes:** `POST /api/contracts/[id]/chat` `{ message }`. Steps: ownership → `sanitizeForLLM(message)` → get-or-create session → fetch full history (asc, ≤ 200) → classify query (contract/history/both) → `lib/openai/chat.ts` GPT-4o temp 0.4, max 1000 out, system prompt "Answer only from the document text provided. If the answer is not in the document, say 'I cannot find this in the document.'", full `contract_text` + history → enforce `[Page X]` → INSERT both messages (parse `page_citation`) → return assistant message.

**State management:** `ChatPanel` local message list seeded from history; append optimistic user message, then assistant on response; disable input while awaiting.

**Component spec:** `ChatPanel` → `MessageList` (user right-aligned, assistant left-aligned with "Source: Page X" link) + `ChatInput`.

**Design:** user bubble brand tint, assistant bubble surface `#FAFAFA`; citation link `#115ACB`; "Based on the document…" framing.

**Edge cases:** answer absent → "I cannot find this in the document" (valid, not a failure); message too long → `message_too_long`; OpenAI failure → retry/error CTA; ≤ 15 s P95; injection attempts sanitised.

---

## Spec 10 — Persistent Chat History (US-012, FR-09) · P1

**User flow:** Reopening a contract loads the prior chat session and messages.

**DB schema touched:** reads `chat_sessions`, `chat_messages`.

**DB tasks:** none beyond Spec 9 writes.

**API routes:** `GET /api/contracts/[id]/chat` → `{ session_id, messages[] }` (asc, ≤ 200).

**State management:** `ChatPanel` initialises from this fetch on mount.

**Component spec:** reuses `MessageList`; shows empty prompt when no history.

**Design:** consistent with Spec 9.

**Edge cases:** no session yet → empty state; >200 messages → most recent 200 (documented cap).

---

## Spec 11 — Dashboard & History (US-008, FR-10) · P1

**User flow:** Post-login dashboard shows totals, NDA/MSA breakdown, last contracts, and a sortable full list; row click opens results.

**DB schema touched:** reads `contracts` (count, type breakdown, list).

**DB tasks:** aggregate query + list; indexes `(user_id, created_at desc)`, `(user_id, contract_type)`.

**API routes:** `GET /api/contracts` → `{ contracts[], totals: { total, nda, msa } }` (or RSC direct read).

**State management:** Server Component initial fetch; client-side sort (date|name|type).

**Component spec:** `SummaryCard` (totals + breakdown), `ReviewContractCTA`, `ContractTable` (sortable columns: name, type, date, status; row → `/contracts/[id]`), empty state.

**Design:** cards 8px radius, surface `#FAFAFA`; status pills (complete green, processing amber, error red); table on 4px grid.

**Edge cases:** empty state ("No contracts reviewed yet…"); error/processing rows clearly labelled; delete removes row.

---

## Spec 12 — Feedback Submission (US-010, FR-12) · P2

**User flow:** On the results page, submit thumbs up/down + optional comment.

**DB schema touched:** `user_feedback` (INSERT rating, comment).

**DB tasks:** INSERT; RLS own-data-only.

**API routes:** `POST /api/feedback` `{ contract_id, rating: 'up'|'down', comment? }`.

**State management:** `FeedbackWidget` local state; disable after submit.

**Component spec:** `FeedbackWidget` (thumbs toggle + optional textarea + submit).

**Design:** thumbs icons lucide 18px; success toast; comment field 6px radius.

**Edge cases:** double submit prevented; comment optional; failure → retry.

---

## Appendix — Cross-cutting specs

**Not-legal-advice disclaimer:** `NotLegalAdviceBanner` on every results page — "This is an AI-assisted review tool, not legal advice. Always verify critical terms with a qualified lawyer." Footer: "Powered by OpenAI GPT-4o".

**Delete contract (GDPR):** `DELETE /api/contracts/[id]` cascades (FK `on delete cascade`) across key_terms, custom_key_terms, chat_sessions, chat_messages, user_feedback + removes Storage object. Confirmation modal required.

**Security (Stage 3 dependencies):** `requireAuth()`, `rateLimiter` (`rate_limit_events`, sliding window on upload/process/chat), `sanitizeForLLM()` (chat + custom terms), `tokenLimiter`/`validateFileUpload()`, `chatSecurity` ownership checks, `inputValidator` Zod. RLS verified cross-account before launch.

**Env vars (Stage 2 `.env.example`):** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server), `OPENAI_API_KEY` (server), `OPENAI_MODEL`, `OPENAI_USER_TAG`, `APP_URL`.
