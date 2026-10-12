-- Lights the supporter map from imported YM gifts, not just Give clicks.
--
-- The import keeps only the donor's US state as a postal code (Home_State,
-- falling back to Billing_State). No street, city or zip is saved. The map
-- still never shows a count under 3: has_gift only says "at least one gift
-- came from this state", the same rule as has_give_click.
--
-- Also carries 0005's has_give_click, which was never applied to the live
-- database. The return type changes, so the function is dropped and
-- recreated inside one transaction so anon callers never see it missing.

begin;

alter table pad.donations add column if not exists donor_state text
  check (donor_state ~ '^[A-Z]{2}$');

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
  has_give_click boolean,
  gifts int,
  has_gift boolean
)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  with visits as (
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
  gifts as (
    select d.donor_state as code, count(*) as gifts
    from pad.donations d
    where d.donor_state is not null
    group by d.donor_state
  ),
  us as (
    select
      coalesce(v.code, g.code) as code,
      coalesce(v.name, g.code) as name,
      coalesce(v.visits, 0) as visits,
      coalesce(v.clicks, 0) as clicks,
      coalesce(g.gifts, 0) as gifts
    from visits v
    full join gifts g on g.code = v.code
  ),
  totals as (
    select
      coalesce((select sum(visits) from visits), 0)::int as us_total,
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
    us.clicks > 0,
    case when us.gifts >= 3 then us.gifts::int end,
    us.gifts > 0
  from us cross join totals t;
$$;

revoke all on function pad.supporter_map() from public;
grant execute on function pad.supporter_map() to anon, authenticated;

commit;
