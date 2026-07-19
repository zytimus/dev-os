# Spec — Authentication & Session (US-001, FR-01)

**Goal:** email/password auth via Supabase Auth; private per-user data; protected routes redirect unauthenticated users to `/login`. Auth completes ≤ 10 s.

## Supabase clients — `lib/supabase/`
Use `@supabase/ssr`. Three factories:

- `lib/supabase/client.ts` — browser client (`createBrowserClient`) using `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Used in Client Components for auth actions and reads.
- `lib/supabase/server.ts` — server client (`createServerClient`) wired to `cookies()` from `next/headers` (read + write cookie handlers). Used in Server Components and Route Handlers. Reads session from cookies.
- `lib/supabase/admin.ts` — service-role client using `SUPABASE_SERVICE_ROLE_KEY` (**server only**) for privileged writes (e.g. inserting extraction results). Never import in client code.

```ts
// lib/supabase/server.ts (shape)
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );
}
```

## Route protection — `middleware.ts`
- Refresh session (`supabase.auth.getUser()`), then guard protected paths: `/dashboard`, `/review`, `/contracts/:path*`.
- Unauthenticated → redirect `/login`. Authenticated hitting `/login` or `/signup` → redirect `/dashboard`.
- `matcher`: exclude `_next/static`, `_next/image`, `favicon`, and public assets.

## Pages / components
- `/signup` (`app/signup/page.tsx`, Client) — `AuthForm` mode="signup" → `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${APP_URL}/auth/callback` } })`.
- `/login` (`app/login/page.tsx`, Client) — `AuthForm` mode="login" → `supabase.auth.signInWithPassword({ email, password })` → on success `router.push('/dashboard')`.
- `app/auth/callback/route.ts` — exchange `?code` for a session (`supabase.auth.exchangeCodeForSession`), then redirect `/dashboard`.
- Sign out — `supabase.auth.signOut()` then redirect `/`.
- `components/auth/AuthForm.tsx` — email + password inputs, submit, loading + inline error. Design: centered card (`--radius-card`, `--bg-surface`), primary button `--brand`, error text `--color-red-500`.

## DB
- `profiles` row auto-created by the `on_auth_user_created` trigger (see `supabase-schema.sql`). No app write needed on signup.

## Server-side login/logout routes
`POST /api/auth/login` and `POST /api/auth/logout` (cookie-correct server handlers) are delivered by **Stage 3 (`/security-foundation`)**. Until then, client-side `signInWithPassword` / `signOut` are used.

## Edge cases
- Invalid credentials → clear inline error ("Invalid email or password").
- Unverified email → prompt to check inbox; block dashboard until verified.
- Duplicate email on signup → friendly message.
- Expired/absent session → middleware redirect to `/login`.
- Auth round-trip must complete ≤ 10 s (loading state on submit).
