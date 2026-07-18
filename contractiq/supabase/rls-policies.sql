-- =============================================================================
-- ContractIQ — Security foundation SQL (Stage 3)
-- Run AFTER docs/specs/supabase-schema.sql. Idempotent.
-- Adds the rate_limit_events table used by lib/security/rateLimiter.ts and
-- (re)asserts RLS on all application tables.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- rate_limit_events — sliding-window rate limiting
-- ---------------------------------------------------------------------------
create table if not exists public.rate_limit_events (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  action     text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_lookup_idx
  on public.rate_limit_events (user_id, action, created_at desc);

alter table public.rate_limit_events enable row level security;

-- Users may read their own events; writes happen via the service-role client
-- (bypasses RLS) so no insert policy is granted to end users.
drop policy if exists "rate_limit_events_select_own" on public.rate_limit_events;
create policy "rate_limit_events_select_own" on public.rate_limit_events
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Defense-in-depth: ensure RLS is enabled on every application table
-- (idempotent; safe to run repeatedly).
-- ---------------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.contracts        enable row level security;
alter table public.key_terms        enable row level security;
alter table public.custom_key_terms enable row level security;
alter table public.chat_sessions    enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.user_feedback    enable row level security;

-- =============================================================================
-- End of security foundation SQL.
-- =============================================================================
