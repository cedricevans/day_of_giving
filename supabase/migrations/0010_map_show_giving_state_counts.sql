-- Shows exact counts for any state with at least one gift, instead of waiting
-- for 3 visitors. States with no gift keep the under-3 rule for visit counts.
-- Same return type as 0009, so create or replace is enough.

begin;

create or replace function pad.supporter_map()
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
      coalesce(g.gifts, 0) as gifts,
      coalesce(v.visits, 0) >= 3 or coalesce(g.gifts, 0) > 0 as show
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
    case when us.show then us.visits::int end,
    case when us.show then us.clicks::int end,
    case when us.show and t.us_total > 0
      then round(us.visits * 100.0 / t.us_total, 1) end,
    not us.show,
    t.us_total,
    t.intl_total,
    us.clicks > 0,
    case when us.gifts > 0 then us.gifts::int end,
    us.gifts > 0
  from us cross join totals t;
$$;

revoke all on function pad.supporter_map() from public;
grant execute on function pad.supporter_map() to anon, authenticated;

commit;
