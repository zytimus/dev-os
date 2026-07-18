-- Conversation Memory Layer — add source attribution to chat messages.
-- Records which context an assistant answer was drawn from so the UI can attribute it:
--   'contract' | 'history' | 'both'  (null for user turns and pre-existing rows).
-- Idempotent: safe to run against an existing database.

alter table public.chat_messages
  add column if not exists source text;

alter table public.chat_messages
  drop constraint if exists chat_messages_source_check;

alter table public.chat_messages
  add constraint chat_messages_source_check
  check (source is null or source in ('contract', 'history', 'both'));
