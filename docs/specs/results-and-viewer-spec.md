# Spec — Results Page, Viewer & Inline Edit (US-003/004/006/009, FR-04/06/07/11)

**Goal:** two-panel results view — document viewer (PDF.js primary, `[PAGE N]` text fallback) on the left, key-terms panel on the right — with page navigation, confidence colour-coding, source-sentence disclosure, and inline term editing.

## Data load — `app/contracts/[id]/page.tsx` (Server Component shell)
- `requireAuth()`; fetch via `GET /api/contracts/[id]` semantics: `{ contract, key_terms, signed_url }` (1-hour signed URL when `file_path` present, else null).
- Renders Client panels: `DocumentViewer`, `KeyTermsPanel`, `ChatPanel`, `FeedbackWidget`, and the mandatory `NotLegalAdviceBanner`.
- Shared state (Client): `targetPage: number | null` — set by page links / citations, consumed by the viewer.

## Document viewer — `components/contract/`
- `DocumentViewer` chooses variant from `signed_url`:
  - `PdfViewer` (primary) — `pdfjs-dist`: render all pages, scroll, zoom in/out, **lazy-load pages**, highlight; reacts to `targetPage` (smooth-scroll + highlight). Uses the signed URL.
  - `TextViewerFallback` — parses `[PAGE N]` markers from `contract.contract_text` into labelled page sections; same `targetPage` scroll behaviour; offers a "Download PDF" link if `signed_url` exists.
- Both accept `{ targetPage, ... }` and expose identical navigation so key-term/citation clicks behave the same regardless of variant.

## Key-terms panel — `components/contract/`
- `KeyTermsPanel` renders `KeyTermRow[]` (order standard first, then custom).
- `KeyTermRow` columns: **Term Name | Value | PageLink | ConfidenceBadge | WhyDisclosure | (edit)**.
  - `PageLink` → sets `targetPage` = `page_number`.
  - `ConfidenceBadge` (`components/contract/ConfidenceBadge.tsx`): maps `confidence_score` →
    - ≥ 0.80 → green `--color-green-500` ("High")
    - 0.50–0.79 → amber `--color-yellow-500` ("Medium")
    - < 0.50 → red `--color-red-500` + ⚠️ icon + **non-dismissible** tooltip: "Low confidence — we recommend verifying this in the document directly." Term is **never hidden**. On render of a low-confidence term, auto-set `targetPage` hint to highlight the nearest span.
  - `WhyDisclosure` → expandable, shows verbatim `source_sentence`.
  - Custom terms show a "Custom" badge (accent `--color-violet-500`).

## Inline edit — `PATCH /api/key-terms/[id]`
- `KeyTermRow` edit mode: editable input + save/cancel; **optimistic** update, rollback on error; ≤ 2 s target.
- Route: `requireAuth()`; validate `keyTermEditSchema` (`value` non-empty ≤ 2000); load term (RLS); if `original_ai_value` is null, copy current `value` → `original_ai_value` (first-edit guard); set `value`, `is_edited=true`. `updated_at` trigger fires. Returns `{ key_term }`.
- `EditedBadge` shows when `is_edited` (subtle `--bg-subtle`). Edits feed the `term_corrections` view.

## Design (docs/design.md)
- Panels/cards `--radius-card`, surface `--bg-surface`; brand links/CTAs `--brand`; 4px grid spacing; lucide icons 18px/1.5; confidence uses icon **and** colour (a11y). Two-panel collapses to stacked/tabbed on narrow screens (WCAG 2.1 AA).

## Edge cases
- `signed_url` null/expired → text fallback (AI results unaffected).
- `page_number` beyond rendered range → clamp + toast.
- Empty value on save → `validation_error` (rejected).
- `original_ai_value` never overwritten on subsequent edits.
- Complex PDF fails to render → "Download PDF" link fallback.
