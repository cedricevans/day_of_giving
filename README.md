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

`src/lib/campaign.ts` — campaign name, goal amount, gift tier amounts.
`raisedCents` is a manual number updated from PAD's weekly donation export
(Step 8 in the plan doc) until PAD's YourMembership API is licensed; there's
no live donation feed on our side.

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
- **Donations** — add rows from the weekly YM export, CSV export

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

## What's not live yet

- The `pad` schema isn't exposed to the API yet — see Setup step 2. Until
  that dashboard setting is saved, tracking/leads/`/admin` all fail with a
  406 error (logged to console, never shown to visitors — the landing page
  itself still works, buttons just link straight to pad.org).
- This code has not been deployed anywhere (Vercel, Netlify, etc.) or
  connected to a domain.
