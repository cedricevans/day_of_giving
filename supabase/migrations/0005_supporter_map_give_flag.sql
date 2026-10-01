-- Adds has_give_click so the landing page map can light up a state on its
-- first Give click. Counts stay hidden under 3 (few = true); this flag only
-- says "at least one supporter in this state tapped Give", never how many.
--
-- The return type changes, so the function has to be dropped and recreated.
-- Wrapped in a transaction so the RPC is never missing for anon callers.

begin;

drop function if exists pad.supporter_map();

create function pad.supporter_map()
returns table (
  region_code text,
  region text,
  supporters int,
  give_clicks int,
  share numeric,
  few boolean,
  total_us int,
  total_intl int,
  has_give_click boolean
)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  with us as (
    select
      s.geo_region_code as code,
      max(s.geo_region) as name,
      count(*) as visits,
      count(*) filter (
        where exists (
          select 1 from pad.events e
          where e.session_id = s.id and e.event_type = 'donate_click'
        )
      ) as clicks
    from pad.sessions s
    where s.geo_country_code = 'US' and s.geo_region_code is not null
    group by s.geo_region_code
  ),
  totals as (
    select
      coalesce((select sum(visits) from us), 0)::int as us_total,
      (select count(*) from pad.sessions
        where geo_country_code is not null and geo_country_code <> 'US')::int as intl_total
  )
  select
    us.code,
    us.name,
    case when us.visits >= 3 then us.visits::int end,
    case when us.clicks >= 3 then us.clicks::int end,
    case when us.visits >= 3 and t.us_total > 0
      then round(us.visits * 100.0 / t.us_total, 1) end,
    us.visits < 3,
    t.us_total,
    t.intl_total,
    us.clicks > 0
  from us cross join totals t;
$$;

revoke all on function pad.supporter_map() from public;
grant execute on function pad.supporter_map() to anon, authenticated;

commit;
