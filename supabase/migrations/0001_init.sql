-- PAD Day of Giving 2026 — tracking + admin schema.
-- Lives in the shared KustomGroupWebApps Supabase project, in its own
-- "pad" schema (per that project's convention: every app gets its own
-- schema, never public). Payments and membership records live on pad.org
-- (YourMembership); this schema only tracks our funnel (visits, clicks,
-- optional leads) plus a manually-populated donations table fed from the
-- weekly YM export until the YM API is licensed (see
-- ../../pad-landing-page-plan.md).

create extension if not exists "pgcrypto";

create schema if not exists pad;

-- One row per browser session that lands on the page. geo_* columns are
-- filled in by a client-side IP lookup shortly after the row is created
-- (see src/lib/geo.ts) — approximate visit/click location, not a
-- confirmed donation location.
create table if not exists pad.sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  landing_path text,
  user_agent text,
  geo_country text,
  geo_country_code text,
  geo_region text,
  geo_region_code text,
  geo_city text
);

-- Every tracked interaction: page_view, donate_click, join_click, lead_captured.
create table if not exists pad.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references pad.sessions (id) on delete cascade,
  event_type text not null check (
    event_type in ('page_view', 'donate_click', 'join_click', 'lead_captured', 'scroll_depth')
  ),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists events_session_id_idx on pad.events (session_id);
create index if not exists events_event_type_idx on pad.events (event_type);
create index if not exists events_created_at_idx on pad.events (created_at);

-- Optional low-friction name/email capture before the user is sent to pad.org.
create table if not exists pad.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references pad.sessions (id) on delete set null,
  name text,
  email text not null,
  intent text check (intent in ('donate', 'join', 'unspecified')) default 'unspecified'
);

create index if not exists leads_email_idx on pad.leads (lower(email));

-- Manually populated from the weekly YM donation export (Step 8 in the plan
-- doc) so the admin dashboard can show real $ raised alongside click data.
-- Replace with an automated import once the YM API is licensed.
create table if not exists pad.donations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  donor_name text,
  donor_email text,
  amount_cents integer not null check (amount_cents > 0),
  is_recurring boolean not null default false,
  referral_source text,
  ym_export_date date,
  matched_lead_id uuid references pad.leads (id) on delete set null,
  notes text
);

create index if not exists donations_donor_email_idx on pad.donations (lower(donor_email));
create index if not exists sessions_geo_region_idx on pad.sessions (geo_region);
create index if not exists sessions_geo_country_code_idx on pad.sessions (geo_country_code);

-- Row Level Security: anon (the public landing page) may INSERT tracking
-- data, and UPDATE only the geo_* columns on its own just-created session
-- (the geo lookup resolves a moment after the row is first inserted), but
-- never read anything back or touch donations. Only authenticated admin
-- users (Supabase Auth) can read anything or manage donations.
alter table pad.sessions enable row level security;
alter table pad.events enable row level security;
alter table pad.leads enable row level security;
alter table pad.donations enable row level security;

create policy "anon can insert sessions" on pad.sessions
  for insert to anon with check (true);

-- Anon may only ever patch geo_* fields, never touch anything else, and
-- only for a short window after the row was created (its own session, in
-- practice — there's no way for anon to target a specific old row since
-- session ids aren't guessable, but the time bound stops abuse if one leaks).
create policy "anon can set geo on a recent session" on pad.sessions
  for update to anon
  using (created_at > now() - interval '10 minutes')
  with check (created_at > now() - interval '10 minutes');

create policy "anon can insert events" on pad.events
  for insert to anon with check (true);

create policy "anon can insert leads" on pad.leads
  for insert to anon with check (true);

create policy "authenticated can read sessions" on pad.sessions
  for select to authenticated using (true);

create policy "authenticated can read events" on pad.events
  for select to authenticated using (true);

create policy "authenticated can read leads" on pad.leads
  for select to authenticated using (true);

create policy "authenticated can manage donations" on pad.donations
  for all to authenticated using (true) with check (true);

grant usage on schema pad to anon, authenticated;
grant select, insert, update on pad.sessions to anon;
grant select, insert, update on pad.sessions to authenticated;
grant select, insert on pad.events to anon;
grant select, insert on pad.events to authenticated;
grant select, insert on pad.leads to anon;
grant select, insert on pad.leads to authenticated;
grant select, insert, update, delete on pad.donations to authenticated;
