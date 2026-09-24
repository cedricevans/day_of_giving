# PAD Day of Giving 2026 — Landing Page

React + Vite + Tailwind landing page for Phi Alpha Delta's Day of Giving
campaign. Funnels visitors to PAD's real donation and membership pages on
pad.org (payments are never handled here — see
[`../pad-landing-page-plan.md`](../pad-landing-page-plan.md) for why), while
tracking visits, clicks, and optional name/email leads in Supabase. Includes
a password-protected `/admin` dashboard for the campaign team.

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

### 2. Create the Supabase project

This app expects its **own** Supabase project (not the shared
`KustomGroupWebApps` project used by other apps in this workspace) — donor
data deserves its own boundary.

1. Create a new project at [supabase.com](https://supabase.com/dashboard).
2. Copy `.env.example` to `.env` and fill in the project URL and anon key
   (Project Settings → API).
3. Run the migration to create the tracking tables:
   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```
   Or paste `supabase/migrations/0001_init.sql` into the Supabase SQL editor.
4. Create at least one admin user for `/admin` (Authentication → Users → Add
   user, email + password — no signup form exists in the app on purpose, so
   this is the only way in).

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

`src/lib/campaign.ts` — campaign name, goal amount. `raisedCents` is a
manual number updated from PAD's weekly donation export (Step 8 in the plan
doc) until PAD's YourMembership API is licensed; there's no live donation
feed on our side.

### 5. Run

```bash
npm run dev
```

## Admin dashboard

`/admin` (redirects to `/admin/login` if not signed in). Shows:

- Visit count, donate/join click counts, leads captured, click-through rate
- Raised total — **manually entered**, see "Update campaign copy" above
- Leads table with CSV export
- Donations table: add rows from the weekly YM export, with CSV export

Auth is Supabase Auth (real login, not a shared password) — add/remove
admin users from the Supabase dashboard, not from the app.

## Data model

See `supabase/migrations/0001_init.sql`. Four tables: `sessions` (one per
visit), `events` (page_view/donate_click/join_click/lead_captured),
`leads` (optional name/email capture), `donations` (manually populated).
RLS: anonymous visitors can only INSERT tracking rows; only authenticated
admin users can read anything or manage donations.

## What's not live yet

- No Supabase project is provisioned — `.env` currently has no real
  credentials until you complete Setup step 2. Without it, the landing page
  still works (buttons just link straight to pad.org), but tracking, lead
  capture, and `/admin` are disabled with a console warning.
- This code has not been deployed anywhere (Vercel, Netlify, etc.) or
  connected to a domain.
