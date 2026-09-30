# PAD Day of Giving 2026 — Landing Page

React + Vite + Tailwind landing page for Phi Alpha Delta's Day of Giving
campaign. Funnels visitors to PAD's real donation and membership pages on
pad.org (payments are never handled here — see
[`../pad-landing-page-plan.md`](../pad-landing-page-plan.md) for why), while
tracking visits, clicks, approximate location, and optional name/email leads
in Supabase. Includes a password-protected `/admin` dashboard for the
campaign team.

## Stack

- React 19 + TypeScript + Vite
- Tailwind CSS v4 (PAD purple/gold brand tokens in `src/index.css`)
- Framer Motion (parallax hero, scroll-in animations)
- React Router (`/`, `/admin/login`, `/admin`)
- Supabase (Postgres tracking tables + Auth for admin login)

## Setup

### 1. Install

```bash
npm install
```

### 2. Supabase project

This app's tables live in the **`pad` schema** of the shared
`KustomGroupWebApps` Supabase project (ref `qwhdeenasiollfyftdbb`), not a
standalone project — the org is at its 2-project free-tier limit, so a
dedicated project wasn't an option. Every app in that project gets its own
schema (never `public`); `pad` is this one's.

The schema, all 4 tables, and RLS policies already exist there (applied via
`supabase/migrations/0001_init.sql`). **One manual step is still required
and can only be done in the dashboard, not the CLI** (project settings
aren't reachable from a CLI token outside the project's own org):

1. Go to the Supabase dashboard → **KustomGroupWebApps** project → Project
   Settings → API → **Exposed schemas** → add `pad` to the list → Save.
   Until this is done, every request from this app gets a 406
   `Invalid schema: pad` error.
2. Copy `.env.example` to `.env` and fill in:
   - `VITE_SUPABASE_URL=https://qwhdeenasiollfyftdbb.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — the project's anon/publishable key (Project
     Settings → API → Project API keys). **Never commit this file** —
     `.env` is gitignored.
3. Create at least one admin user for `/admin` (Authentication → Users → Add
   user, email + password — no signup form exists in the app on purpose, so
   this is the only way in).

If a dedicated PAD project becomes available later (org upgraded, or a slot
freed up), migrating means: create the project, run
`supabase link --project-ref <new-ref>` then `supabase db push`, drop
`db: { schema: 'pad' }` from `src/lib/supabase.ts` (tables would live in
`public` there), and regenerate `src/lib/database.types.ts` accordingly.

### 3. Set the campaign links

Still in `.env`:

- `VITE_PAD_DONATE_URL` — PAD's donation page for this campaign's fund, e.g.
  `https://www.pad.org/donations/donate.asp?id=<FUND_ID>` (get the fund ID
  from PAD's YM admin — Step 1 in the plan doc).
- `VITE_PAD_JOIN_URL` — PAD's membership application page.
- `VITE_CAMPAIGN_UTM_SOURCE` — tag used on outbound links for analytics.

**On "populating" the donation page:** PAD's donate.asp form (tested
2026-09-24 against a live fund) does not expose a documented way to
pre-fill the dollar amount via URL parameters — only the fund itself is
selected via `?id=`. If PAD adds that later, wire it into
`withTracking()` in `src/lib/campaign.ts`. Don't assume it works without
testing a real submission first.

### 4. Update campaign copy/goal

`src/lib/campaign.ts` — campaign name, goal amount, gift tier amounts, and
`dayOfGivingDate` (the Scoreboard countdown stays hidden until it's set).

The Scoreboard's dollars raised and donor count come from `pad.donations`,
which admins fill in from PAD's weekly YM export (Admin, Donations tab).
It updates on the page within 30 seconds of a row being saved, but it is
only as current as the latest export until the YM API is licensed.

### 5. Run

```bash
npm run dev
```

## Admin dashboard

`/admin` (redirects to `/admin/login` if not signed in). Tabs:

- **Overview** — visit/click/lead KPIs, recent event feed
- **Locations** — visits and Donate/Join clicks grouped by state/region,
  inferred client-side from IP (see Geolocation below). This is where
  interest and clicks come from, **not** confirmed donations — PAD's
  donation records don't include location unless you add it by hand.
- **Leads** — captured name/email, CSV export
- **Donations** — add rows from the weekly YM export (including chapter,
  if known), CSV export
- **Community** — hide or restore Wall posts (or everything from one
  sender), edit the blocked-words list, add or turn off quick polls, and
  paste in the official chapter list for the chapter picker

Auth is Supabase Auth (real login, not a shared password) — add/remove
admin users from the Supabase dashboard, not from the app.

## Geolocation

`src/lib/geo.ts` calls [ipwho.is](https://ipwho.is) (free, no API key,
HTTPS, ~1,000 requests/day/domain) once per browser tab, shortly after a
session row is created, and patches `geo_country` / `geo_region` /
`geo_city` etc. onto that row. It never blocks the page and fails silently
(ad blockers, offline, rate limit) — a missing location just means that
visit shows as "Unknown" in the Locations tab. Disclosed to visitors in the
footer.

## Data model

See `supabase/migrations/0001_init.sql`. Four tables in the `pad` schema:
`sessions` (one per visit, includes geo_* columns), `events`
(page_view/donate_click/join_click/lead_captured), `leads` (optional
name/email capture), `donations` (manually populated). RLS: anonymous
visitors can INSERT tracking rows and UPDATE only their own session's
geo_* fields within 10 minutes of creation (for the async geo patch);
only authenticated admin users can read anything or manage donations.

## Scoreboard, Wall, and polls

Added in `supabase/migrations/0004_scoreboard_wall_polls.sql` (applied to
the live database by hand on 2026-09-29, like 0001 through 0003, so it is not
in `supabase_migrations.schema_migrations`). Anonymous
visitors have no direct access to the new tables; every public read and
write goes through a `pad.*` security definer function (`scoreboard`,
`chapter_leaderboard`, `wall_feed`, `post_to_wall`, `toggle_wall_reaction`,
`active_polls`, `vote_poll`). Validation lives in those functions, so it
can't be skipped by calling the API directly:

- Wall posts publish immediately. They are rejected if they contain a
  blocked word (whole words, with basic leetspeak like `a$$` caught) or a
  link, and rate limited to 1 per 30 seconds and 10 per day per browser.
- "Chapters in" and the Chapter Challenge count chapters named on Give
  clicks, Wall posts, and donations. Chapter on a Give click is what the
  visitor typed, not a confirmed gift. The leaderboard ranks by dollars
  once any donation has a chapter, otherwise by supporters.
- Reactions and votes are tied to a random per-browser id in
  localStorage, not to a person.

## What's not live yet

- The `pad` schema isn't exposed to the API yet — see Setup step 2. Until
  that dashboard setting is saved, tracking/leads/`/admin` all fail with a
  406 error (logged to console, never shown to visitors — the landing page
  itself still works, buttons just link straight to pad.org).
- This code has not been deployed anywhere (Vercel, Netlify, etc.) or
  connected to a domain.
