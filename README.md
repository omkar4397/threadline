# Threadline

A responsive planning app for a solo fashion consultant: clients, projects, tasks and milestones on a timeline, vendors and designers.

- **Timeline**: Gantt chart (or list view on small screens) of every project's tasks and milestones, coloured by client or by status, with today marker, delivery milestones, at-risk flags, an overlap strip, week/month/quarter zoom, an "Assigned to" filter (anyone, my tasks, unassigned, a partner) and drag-to-reschedule on laptop.
- **Clients & projects**: a project is a name and delivery date; add tasks (title from a quick-pick list or typed, start and end date, assigned to me, a vendor, a designer or nobody) and single-date milestones whenever you plan them.
- **Pricing** (per project, private): lines for fabric, designing, sampling, production, courier or your own item types, each with a quantity and unit, the vendor's agreed price (INR) and the price quoted to the client (any currency). Shows margin per line and in total, plus a consulting fee and total earnings. Foreign currencies use a rate locked per project (updatable, or typed by hand), with a two-way converter. Daily rates come free from ExchangeRate-API (no key), with a free backup source.
- **Expenses**: record what each project costs, with a category (five built in, plus any you type), an optional task and an optional vendor or designer as payee. Projects show totals by category; tasks show what was spent on them; vendor and designer pages list payments across all projects.
- **Expenses overview**: spending across all projects, filtered by period, client, project, category and vendor/designer, with headline totals, spend per month, breakdowns by category, payee, project and client (tap a bar to filter), and a CSV download. Each project's expenses can be filtered by category and payee too.
- **Vendors & designers**: searchable directory; each detail page lists their current assignments and payments across clients.
- **Settings**: edit the quick-pick task names, expense categories, and pricing item types and products; change password; sign out.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + Auth + RLS) · Vercel.

## Planning rules

- Tasks are free-form: each has its own dates and moves on its own (no automatic shifting of other tasks).
- A milestone is a single-date task, drawn as a round marker on the timeline.
- Assigning a vendor or designer with a typical lead time offers to set the end date from it; it is never applied automatically.
- A project is **at risk** when an unfinished task is past its end date, or an unfinished task or milestone ends after the delivery date.

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
