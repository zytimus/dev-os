# Spec — Contract Chat (US-007, US-012, FR-08, FR-09)

**Goal:** answer questions grounded strictly in the uploaded contract text, with a mandatory `[Page X]` citation, full conversation memory, and persistence. Target ≤ 15 s P95.

## Routes — `app/api/contracts/[id]/chat/route.ts`

### POST (ask a question)
1. `requireAuth()` + `rateLimiter`.
2. Load contract (RLS-scoped); `404 not_found` if missing. `chatSecurity` verifies contract + session ownership (Stage 3).
3. Validate `chatMessageSchema` (`message` ≤ 2000, else `message_too_long`). `sanitizeForLLM(message)` (Stage 3).
4. Get-or-create the `chat_sessions` row for this contract.
5. Fetch full history for the session: `chat_messages` ascending, limit 200.
6. `classifyQuery(message, history)` → `'contract' | 'history' | 'both'` (heuristic, **no extra API call**) — adjusts the system prompt and whether the full contract text is included.
7. `chat({ contractText, history, message, mode })` (below) → assistant text containing `[Page X]`.
8. INSERT user message, then assistant message (parse `page_citation` from the last `[Page N]` in the text).
9. Return `200 { message: ChatMessage }` (assistant).
10. OpenAI failure after retries → `502 openai_error` (client offers retry).

### GET (load history)
- `requireAuth()`; find session for contract; return `200 { session_id, messages }` (ascending, ≤200). No session yet → `{ session_id: null, messages: [] }`.

## OpenAI orchestration — `lib/openai/chat.ts`
- `temperature: 0.4`, `max_tokens: 1000`, model `OPENAI_MODEL`, `user: OPENAI_USER_TAG`, 3× retry/backoff.
- **Message array:** `[system, ...history (asc, role+content), user]`.
- **System prompt:**
  ```
  You are ContractIQ. Answer ONLY from the document text provided below. If the answer is not
  in the document, reply exactly: "I cannot find this in the document."
  - Begin every answer with "Based on the document, ...".
  - End every answer with a citation of the form [Page X] pointing to the page the answer is on.
  - Do not use general legal knowledge; do not give legal advice.

  DOCUMENT (with [PAGE N] markers):
  <full contract_text>   // included when mode is 'contract' or 'both'
  ```
- **Full-context strategy:** for contracts ≤ 15,000 tokens the entire `contract_text` is passed every turn (no chunking/RAG at MVP). Full history (≤ 200) is always passed for memory-style questions.
- **Query classification:** `history`-only questions ("what did you ask earlier?") may omit the document to save tokens; `both` includes document + leans on history.

## Client — `components/contract/ChatPanel.tsx`
- On mount, GET history → seed `MessageList`.
- Send: optimistic user bubble → POST → append assistant bubble; disable input while awaiting; error → inline retry.
- `MessageList`: user right-aligned (brand tint), assistant left-aligned (`--bg-surface`), assistant shows a "Source: Page X" link parsed from `page_citation` → sets results-page `targetPage` (scrolls the viewer).

## Edge cases
- Answer absent → "I cannot find this in the document." (correct, not a failure).
- Message too long → `message_too_long`.
- Missing `[Page X]` in model output → post-process to append best-effort page or omit citation link (log for prompt review).
- >200 messages → most recent 200 (documented cap).
- Injection attempt in question → neutralised by `sanitizeForLLM`.
