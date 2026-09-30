-- PAD Day of Giving 2026 — tracking + admin schema
-- Payments and membership records live on pad.org (YourMembership); this
-- schema only tracks our funnel (visits, clicks, optional leads) plus a
-- manually-populated donations table fed from the weekly YM export until
-- the YM API is licensed (see ../../pad-landing-page-plan.md).

create extension if not exists "pgcrypto";

-- One row per browser session that lands on the page.
create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  landing_path text,
  user_agent text
);

-- Every tracked interaction: page_view, donate_click, join_click, lead_captured.
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references public.sessions (id) on delete cascade,
  event_type text not null check (
    event_type in ('page_view', 'donate_click', 'join_click', 'lead_captured', 'scroll_depth')
  ),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists events_session_id_idx on public.events (session_id);
create index if not exists events_event_type_idx on public.events (event_type);
create index if not exists events_created_at_idx on public.events (created_at);

-- Optional low-friction name/email capture before the user is sent to pad.org.
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  session_id uuid references public.sessions (id) on delete set null,
  name text,
  email text not null,
  intent text check (intent in ('donate', 'join', 'unspecified')) default 'unspecified'
);

create index if not exists leads_email_idx on public.leads (lower(email));

-- Manually populated from the weekly YM donation export (Step 8 in the plan
-- doc) so the admin dashboard can show real $ raised alongside click data.
-- Replace with an automated import once the YM API is licensed.
create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  donor_name text,
  donor_email text,
  amount_cents integer not null check (amount_cents > 0),
  is_recurring boolean not null default false,
  referral_source text,
  ym_export_date date,
  matched_lead_id uuid references public.leads (id) on delete set null,
  notes text
);

create index if not exists donations_donor_email_idx on public.donations (lower(donor_email));

-- Row Level Security: anon (the public landing page) may INSERT tracking
-- data but never read it back or touch donations. Only authenticated admin
-- users (Supabase Auth) can read anything or manage donations.
alter table public.sessions enable row level security;
alter table public.events enable row level security;
alter table public.leads enable row level security;
alter table public.donations enable row level security;

create policy "anon can insert sessions" on public.sessions
  for insert to anon with check (true);

create policy "anon can insert events" on public.events
  for insert to anon with check (true);

create policy "anon can insert leads" on public.leads
  for insert to anon with check (true);

create policy "authenticated can read sessions" on public.sessions
  for select to authenticated using (true);

create policy "authenticated can read events" on public.events
  for select to authenticated using (true);

create policy "authenticated can read leads" on public.leads
  for select to authenticated using (true);

create policy "authenticated can manage donations" on public.donations
  for all to authenticated using (true) with check (true);
