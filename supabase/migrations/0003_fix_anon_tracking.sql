-- Fixes two silent failures in anonymous tracking from 0001_init.sql:
--
-- 1. insert ... returning id failed for anon: RETURNING needs a SELECT
--    policy, and anon deliberately has none. The client now generates the
--    session id itself and inserts without RETURNING (no schema change needed).
--
-- 2. The geo patch (anon UPDATE ... WHERE id = x) matched zero rows for the
--    same reason, since WHERE also needs SELECT visibility. Replaced with a
--    narrow security definer function: it can only set geo_* fields, only
--    once, only on a session created in the last 10 minutes. The broad anon
--    UPDATE policy and grant are removed.

drop policy if exists "anon can set geo on a recent session" on pad.sessions;
revoke update on pad.sessions from anon;

create or replace function pad.set_session_geo(
  p_session_id uuid,
  p_country text,
  p_country_code text,
  p_region text,
  p_region_code text,
  p_city text
)
returns void
language sql
security definer
set search_path = pad, pg_temp
as $$
  update pad.sessions
  set
    geo_country = left(p_country, 100),
    geo_country_code = left(p_country_code, 8),
    geo_region = left(p_region, 100),
    geo_region_code = left(p_region_code, 8),
    geo_city = left(p_city, 100)
  where id = p_session_id
    and created_at > now() - interval '10 minutes'
    and geo_country is null
    and geo_region is null;
$$;

revoke all on function pad.set_session_geo(uuid, text, text, text, text, text) from public;
grant execute on function pad.set_session_geo(uuid, text, text, text, text, text) to anon, authenticated;
