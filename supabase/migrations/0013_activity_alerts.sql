-- Instant wall post alerts and the daily activity summary email, both sent by
-- the pad-alerts edge function.

alter table pad.wall_posts add column if not exists alerted_at timestamptz;

-- pad-alerts reads and claims rows with the service role, which had no
-- access to this schema.
grant usage on schema pad to service_role;
grant select, update on pad.submissions, pad.wall_posts to service_role;

-- One day of site activity, Eastern time. Called by pad-alerts with the
-- service role only.
create or replace function pad.daily_digest(p_day date)
returns jsonb
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  with b as (
    select (p_day::timestamp at time zone 'America/New_York') as s,
           ((p_day + 1)::timestamp at time zone 'America/New_York') as e
  ),
  ses as (select x.* from pad.sessions x, b where x.created_at >= b.s and x.created_at < b.e),
  ev as (select x.* from pad.events x, b where x.created_at >= b.s and x.created_at < b.e),
  gifts as (
    select x.* from pad.donations x, b
    where coalesce(x.donated_at, x.created_at) >= b.s and coalesce(x.donated_at, x.created_at) < b.e
  ),
  placed as (
    select x.id,
      coalesce(nullif(concat_ws(', ',
        nullif(x.geo_city, ''),
        nullif(coalesce(nullif(x.geo_region_code, ''), x.geo_region), ''),
        case when x.geo_country_code is distinct from 'US' then nullif(x.geo_country, '') end
      ), ''), 'Unknown location') as place
    from pad.sessions x where x.id in (select id from ses union select session_id from ev where event_type = 'donate_click')
  )
  select jsonb_build_object(
    'visits', (select count(*) from ses),
    'page_views', (select count(*) from ev where event_type = 'page_view'),
    'give_taps', (select count(*) from ev where event_type = 'donate_click'),
    'join_taps', (select count(*) from ev where event_type = 'join_click'),
    'poll_votes', (select count(*) from pad.poll_votes x, b where x.created_at >= b.s and x.created_at < b.e),
    'submissions', (select count(*) from pad.submissions x, b where x.created_at >= b.s and x.created_at < b.e and x.status <> 'pending_upload'),
    'wall_posts', (select count(*) from pad.wall_posts x, b where x.created_at >= b.s and x.created_at < b.e),
    'gifts', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', donor_name, 'amount_cents', amount_cents, 'chapter', chapter,
        'state', donor_state, 'recurring', is_recurring
      ) order by amount_cents desc nulls last), '[]'::jsonb) from gifts
    ),
    'top_locations', (
      select coalesce(jsonb_agg(jsonb_build_object('place', place, 'n', n) order by n desc, place), '[]'::jsonb)
      from (select p.place, count(*) n from ses join placed p using (id) group by 1 order by 2 desc, 1 limit 5) t
    ),
    'give_locations', (
      select coalesce(jsonb_agg(jsonb_build_object('place', place, 'n', n) order by n desc, place), '[]'::jsonb)
      from (
        select p.place, count(*) n from ev join placed p on p.id = ev.session_id
        where ev.event_type = 'donate_click' group by 1 order by 2 desc, 1 limit 5
      ) t
    ),
    'top_sources', (
      select coalesce(jsonb_agg(jsonb_build_object('src', src, 'n', n) order by n desc, src), '[]'::jsonb)
      from (
        select coalesce(
          nullif(utm_source, ''),
          nullif(regexp_replace(substring(referrer from '://([^/]+)'), '^www\.', ''), ''),
          'Direct or typed in'
        ) as src, count(*) n
        from ses group by 1 order by 2 desc, 1 limit 5
      ) t
    ),
    'campaign', (
      select jsonb_build_object('gifts', count(*), 'total_cents', coalesce(sum(amount_cents), 0)) from pad.donations
    )
  )
$$;

revoke all on function pad.daily_digest(date) from public, anon, authenticated;
grant execute on function pad.daily_digest(date) to service_role;

-- pg_cron triggers the morning summary and pg_net makes its HTTP call. The
-- schedule itself is created outside migrations because it reads a secret
-- from Vault: see the "pad-daily-digest" cron job.
create extension if not exists pg_net;
create extension if not exists pg_cron;
