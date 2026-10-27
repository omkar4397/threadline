# Threadline

A responsive planning app for a solo fashion consultant: clients, projects, an 8-stage production timeline, vendors and designers.

- **Timeline**: Gantt chart (or list view on small screens), coloured by client or by status, with today marker, delivery milestones, at-risk flags, an overlap strip, week/month/quarter zoom, and drag-to-reschedule on laptop.
- **Clients & projects**: create a project, choose its stages and the days each needs; they're scheduled backward from the delivery date.
- **Expenses**: record what each project costs, with a category (five built in, plus any you type), an optional stage and an optional vendor or designer as payee. Projects show totals by category; stages show what was spent on them; vendor and designer pages list payments across all projects.
- **Vendors & designers**: searchable directory; each detail page lists their current assignments and payments across clients.
- **Settings**: edit the stage list (names, order, reference days) and expense categories; change password; sign out.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + RLS) · Vercel.

## Scheduling rules

- When creating a project you pick which stages it needs and enter the days for each. Nothing is filled in from defaults.
- The chosen stages run back to back in their Settings order. The last one ends on the delivery date; each earlier stage ends the day before the next starts. Durations are inclusive calendar days.
- Stages can be added to a project later, or removed one at a time or several at once. Expenses linked to a removed stage stay on the project.
- When a vendor or designer with a typical lead time is assigned, the task panel offers to use it (the longer of the two if both are set).
- Changing a task's end date offers to move later unfinished tasks in that project by the same number of days.
- A project is **at risk** when a task is past its end date and not done, when its schedule ends after the delivery date, or when the remaining work no longer fits before delivery.

The rules live in `src/lib/scheduling` and are covered by `npm test`.

## Login

Single user, username + password. Supabase Auth needs an email, so a username maps to `<username>@threadline.local` internally; no email is ever sent.

The first visit to `/login` shows **Create account** while no account exists. After that, the database refuses any further accounts (`supabase/migrations/20261024000004_owner_account.sql`).

## Supabase setup

1. Create a Supabase project (this one uses `threadline` in `ap-south-1`, Mumbai).
2. Apply the migrations in `supabase/migrations` in order, either with the Supabase CLI (`supabase link --project-ref <ref>` then `supabase db push`) or by pasting each file into the SQL editor.
3. Optional but recommended: **Authentication → Password security → Leaked password protection** on.

## Environment variables

Set these in Vercel (**Project → Settings → Environment Variables**, all environments) and in `.env.local` for local development:

| Name | Where to find it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → publishable key (`sb_publishable_…`) or legacy `anon` key |

Both are safe to expose to the browser; Row Level Security protects the data. Never put the `service_role` / secret key in this app.

## Vercel setup

1. vercel.com → **Add New → Project** → import `omkar4397/threadline` from GitHub.
2. Framework preset: Next.js (detected automatically). Add the two environment variables above.
3. **Settings → Functions → Function Region**: choose **Mumbai (bom1)** so the server sits next to the database.
4. Deploy. Every push to the production branch then deploys automatically; other branches get preview URLs.
5. Open the site, go to `/login` and create your account straight away.

## Development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Checks: `npm run lint && npm run typecheck && npm test && npm run build`.
