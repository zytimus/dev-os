-- =============================================================================
-- ContractIQ — Supabase schema (paste-and-run in the Supabase SQL Editor)
-- Source: docs/engineering/engineering-doc.md §7, §9
-- Safe to run on a fresh project. Idempotent where practical.
-- Covers: extensions, enums, tables, FKs, indexes, updated_at triggers,
--         RLS (own-data-only), profiles auto-provision, term_corrections view,
--         Storage bucket + policies.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists pgcrypto;      -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.contract_type as enum ('nda', 'msa');
exception when duplicate_object then null; end $$;a

do $$ begin
  create type public.contract_status as enum ('uploaded', 'processing', 'complete', 'error');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.message_role as enum ('user', 'assistant');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.feedback_rating as enum ('up', 'down');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- 2. Shared helper functions (triggers)
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-provision a profiles row when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tables (dependency order)
-- ---------------------------------------------------------------------------

-- 3.1 profiles — mirrors auth.users
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- 3.2 contracts — one row per uploaded contract (contract_text is source of truth)
create table if not exists public.contracts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  filename      text not null,
  contract_type public.contract_type not null,
  file_path     text,                                   -- null if Storage upload failed (non-blocking)
  contract_text text not null default '',               -- extracted text with [PAGE N] markers
  page_count    int  not null default 0 check (page_count >= 0 and page_count <= 20),
  token_count   int  not null default 0 check (token_count >= 0 and token_count <= 15000),
  status        public.contract_status not null default 'uploaded',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists contracts_user_created_idx on public.contracts (user_id, created_at desc);
create index if not exists contracts_user_type_idx    on public.contracts (user_id, contract_type);

-- 3.3 key_terms — extracted terms (standard + custom results)
create table if not exists public.key_terms (
  id               uuid primary key default gen_random_uuid(),
  contract_id      uuid not null references public.contracts(id) on delete cascade,
  user_id          uuid not null references auth.users(id) on delete cascade,
  term_name        text not null,
  value            text not null default '',
  page_number      int  check (page_number is null or page_number >= 1),
  confidence_score numeric(4,3) check (confidence_score is null or (confidence_score >= 0 and confidence_score <= 1)),
  source_sentence  text,
  is_custom        boolean not null default false,
  original_ai_value text,                                -- set on first edit; preserves AI original
  is_edited        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists key_terms_contract_idx on public.key_terms (contract_id);

-- 3.4 custom_key_terms — user-requested custom terms captured before processing (<= 5, app-enforced)
create table if not exists public.custom_key_terms (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  term_name   text not null,
  is_manual   boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists custom_key_terms_contract_idx on public.custom_key_terms (contract_id);

-- 3.5 chat_sessions — one session per contract (created lazily)
create table if not exists public.chat_sessions (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists chat_sessions_contract_idx on public.chat_sessions (contract_id);

-- 3.6 chat_messages
create table if not exists public.chat_messages (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.chat_sessions(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          public.message_role not null,
  content       text not null,
  page_citation int check (page_citation is null or page_citation >= 1),
  -- Conversation Memory Layer: source the assistant answered from (null for user turns).
  source        text check (source is null or source in ('contract', 'history', 'both')),
  created_at    timestamptz not null default now()
);
create index if not exists chat_messages_session_created_idx on public.chat_messages (session_id, created_at asc);

-- 3.7 user_feedback
create table if not exists public.user_feedback (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  rating      public.feedback_rating not null,
  comment     text,
  created_at  timestamptz not null default now()
);
create index if not exists user_feedback_contract_idx on public.user_feedback (contract_id);

-- ---------------------------------------------------------------------------
-- 4. updated_at triggers (tables with an updated_at column)
-- ---------------------------------------------------------------------------
drop trigger if exists set_contracts_updated_at on public.contracts;
create trigger set_contracts_updated_at
  before update on public.contracts
  for each row execute function public.set_updated_at();

drop trigger if exists set_key_terms_updated_at on public.key_terms;
create trigger set_key_terms_updated_at
  before update on public.key_terms
  for each row execute function public.set_updated_at();

-- Provision profiles on new auth user
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 5. term_corrections view (feeds the prompt-improvement loop + correction-rate alert)
--    security_invoker => underlying key_terms RLS applies to the querying user.
-- ---------------------------------------------------------------------------
create or replace view public.term_corrections
with (security_invoker = true) as
select
  contract_id,
  user_id,
  term_name,
  original_ai_value,
  value as corrected_value,
  confidence_score,
  updated_at
from public.key_terms
where is_edited = true;

-- ---------------------------------------------------------------------------
-- 6. Row Level Security — own-data-only on every table
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.contracts        enable row level security;
alter table public.key_terms        enable row level security;
alter table public.custom_key_terms enable row level security;
alter table public.chat_sessions    enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.user_feedback    enable row level security;

-- profiles (keyed on id = auth.uid())
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Generic own-data policies for user_id-keyed tables.
-- contracts
drop policy if exists "contracts_select_own" on public.contracts;
create policy "contracts_select_own" on public.contracts for select using (auth.uid() = user_id);
drop policy if exists "contracts_insert_own" on public.contracts;
create policy "contracts_insert_own" on public.contracts for insert with check (auth.uid() = user_id);
drop policy if exists "contracts_update_own" on public.contracts;
create policy "contracts_update_own" on public.contracts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "contracts_delete_own" on public.contracts;
create policy "contracts_delete_own" on public.contracts for delete using (auth.uid() = user_id);

-- key_terms
drop policy if exists "key_terms_select_own" on public.key_terms;
create policy "key_terms_select_own" on public.key_terms for select using (auth.uid() = user_id);
drop policy if exists "key_terms_insert_own" on public.key_terms;
create policy "key_terms_insert_own" on public.key_terms for insert with check (auth.uid() = user_id);
drop policy if exists "key_terms_update_own" on public.key_terms;
create policy "key_terms_update_own" on public.key_terms for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "key_terms_delete_own" on public.key_terms;
create policy "key_terms_delete_own" on public.key_terms for delete using (auth.uid() = user_id);

-- custom_key_terms
drop policy if exists "custom_key_terms_select_own" on public.custom_key_terms;
create policy "custom_key_terms_select_own" on public.custom_key_terms for select using (auth.uid() = user_id);
drop policy if exists "custom_key_terms_insert_own" on public.custom_key_terms;
create policy "custom_key_terms_insert_own" on public.custom_key_terms for insert with check (auth.uid() = user_id);
drop policy if exists "custom_key_terms_update_own" on public.custom_key_terms;
create policy "custom_key_terms_update_own" on public.custom_key_terms for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "custom_key_terms_delete_own" on public.custom_key_terms;
create policy "custom_key_terms_delete_own" on public.custom_key_terms for delete using (auth.uid() = user_id);

-- chat_sessions
drop policy if exists "chat_sessions_select_own" on public.chat_sessions;
create policy "chat_sessions_select_own" on public.chat_sessions for select using (auth.uid() = user_id);
drop policy if exists "chat_sessions_insert_own" on public.chat_sessions;
create policy "chat_sessions_insert_own" on public.chat_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "chat_sessions_delete_own" on public.chat_sessions;
create policy "chat_sessions_delete_own" on public.chat_sessions for delete using (auth.uid() = user_id);

-- chat_messages
drop policy if exists "chat_messages_select_own" on public.chat_messages;
create policy "chat_messages_select_own" on public.chat_messages for select using (auth.uid() = user_id);
drop policy if exists "chat_messages_insert_own" on public.chat_messages;
create policy "chat_messages_insert_own" on public.chat_messages for insert with check (auth.uid() = user_id);
drop policy if exists "chat_messages_delete_own" on public.chat_messages;
create policy "chat_messages_delete_own" on public.chat_messages for delete using (auth.uid() = user_id);

-- user_feedback
drop policy if exists "user_feedback_select_own" on public.user_feedback;
create policy "user_feedback_select_own" on public.user_feedback for select using (auth.uid() = user_id);
drop policy if exists "user_feedback_insert_own" on public.user_feedback;
create policy "user_feedback_insert_own" on public.user_feedback for insert with check (auth.uid() = user_id);
drop policy if exists "user_feedback_delete_own" on public.user_feedback;
create policy "user_feedback_delete_own" on public.user_feedback for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. Storage — private 'contracts' bucket + own-folder policies
--    Path pattern: contracts/{user_id}/{contract_id}/{filename}.pdf
--    (storage.foldername(name))[1] == first path segment == {user_id}
-- ---------------------------------------------------------------------------
-- Wrapped in an exception-guarded block: on projects where the SQL Editor role
-- does not own storage.objects, CREATE POLICY raises `insufficient_privilege`.
-- Without this guard that error would abort the whole script and roll back every
-- table above. The guard lets the core schema commit; storage can then be set up
-- via the Dashboard (Storage > Policies). Storage is non-blocking for the app.
do $$
begin
  insert into storage.buckets (id, name, public)
  values ('contracts', 'contracts', false)
  on conflict (id) do nothing;

  execute 'drop policy if exists "contracts_storage_insert_own" on storage.objects';
  execute 'create policy "contracts_storage_insert_own" on storage.objects
    for insert to authenticated
    with check (bucket_id = ''contracts'' and auth.uid()::text = (storage.foldername(name))[1])';

  execute 'drop policy if exists "contracts_storage_select_own" on storage.objects';
  execute 'create policy "contracts_storage_select_own" on storage.objects
    for select to authenticated
    using (bucket_id = ''contracts'' and auth.uid()::text = (storage.foldername(name))[1])';

  execute 'drop policy if exists "contracts_storage_delete_own" on storage.objects';
  execute 'create policy "contracts_storage_delete_own" on storage.objects
    for delete to authenticated
    using (bucket_id = ''contracts'' and auth.uid()::text = (storage.foldername(name))[1])';

  raise notice 'Storage bucket + policies configured.';
exception
  when insufficient_privilege then
    raise notice 'Storage policies skipped (insufficient privilege). Core schema committed OK. Create the ''contracts'' bucket + own-folder policies via the Dashboard (Storage > Policies). The app works without them via the text-viewer fallback.';
  when others then
    raise notice 'Storage setup skipped: %. Core schema committed OK.', sqlerrm;
end $$;

-- =============================================================================
-- End of ContractIQ schema.
-- NOTE: rate_limit_events table + its policies are created by Stage 3
--       (security-foundation → supabase/rls-policies.sql).
-- =============================================================================
