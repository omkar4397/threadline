@AGENTS.md

# Threadline

Planning app for a solo fashion consultant. Next.js App Router + TypeScript + Tailwind v4, Supabase (Postgres + Auth), deployed on Vercel.

- Schema lives in `supabase/migrations/*.sql`. Every table has `user_id default auth.uid()` and owner-only RLS.
- Reads happen in server components via `@/lib/supabase/server`; writes happen in client components via `@/lib/supabase/client` followed by `router.refresh()`. RLS is the security boundary.
- Scheduling rules are pure functions in `src/lib/scheduling` with Vitest tests (`npm test`).
- Login is username + password; usernames map to `<username>@threadline.local` internally (see `src/lib/auth.ts`).
- Checks before pushing: `npm run lint && npm run typecheck && npm test && npm run build`.
