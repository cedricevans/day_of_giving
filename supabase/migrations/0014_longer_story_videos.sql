-- Allow member story videos up to 35 seconds (40 second hard stop, same 5 second
-- margin as before). Only the duration check changes from 0007.

begin;


create or replace function pad.start_submission(
  p_visitor_id uuid,
  p_name text,
  p_email text,
  p_chapter text,
  p_testimonial text,
  p_consent boolean,
  p_file_bytes bigint,
  p_file_mime text,
  p_duration_seconds numeric,
  p_poster_bytes bigint default null
)
returns table (id uuid, file_path text, poster_path text)
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
declare
  c_max_file_bytes constant bigint := 52428800;   -- matches the bucket limit
  c_max_poster_bytes constant bigint := 524288;
  c_quota_bytes constant bigint := 838860800;     -- 800 MB of the plan's 1 GB
  v_name text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_chapter text := pad.normalize_chapter(p_chapter);
  v_testimonial text := nullif(btrim(coalesce(p_testimonial, '')), '');
  v_has_file boolean := p_file_bytes is not null;
  v_has_poster boolean := p_file_bytes is not null and p_poster_bytes is not null;
  v_id uuid := gen_random_uuid();
  v_path text;
  v_poster text;
begin
  if p_visitor_id is null then
    raise exception 'submit_missing_visitor';
  end if;
  if v_name is null or char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'submit_bad_name';
  end if;
  if v_email is null or char_length(v_email) > 200 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'submit_bad_email';
  end if;
  if char_length(coalesce(v_chapter, '')) > 120 or char_length(coalesce(v_testimonial, '')) > 1500 then
    raise exception 'submit_too_long';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'submit_no_consent';
  end if;
  if not v_has_file and v_testimonial is null then
    raise exception 'submit_empty';
  end if;
  if v_has_file then
    if p_file_bytes <= 0 or p_file_bytes > c_max_file_bytes then
      raise exception 'submit_file_too_large';
    end if;
    if p_file_mime not in ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v') then
      raise exception 'submit_bad_type';
    end if;
    if p_duration_seconds is null or p_duration_seconds > 40 then
      raise exception 'submit_too_long_video';
    end if;
    if v_has_poster and (p_poster_bytes <= 0 or p_poster_bytes > c_max_poster_bytes) then
      raise exception 'submit_bad_poster';
    end if;
    if pad.submission_storage_bytes() + p_file_bytes + coalesce(p_poster_bytes, 0) > c_quota_bytes then
      raise exception 'submit_storage_full';
    end if;
    v_path := 'videos/' || v_id::text || case p_file_mime
      when 'video/webm' then '.webm'
      when 'video/quicktime' then '.mov'
      else '.mp4'
    end;
    if v_has_poster then
      v_poster := 'posters/' || v_id::text || '.jpg';
    end if;
  end if;
  if (
    select count(*) from pad.submissions s
    where s.visitor_id = p_visitor_id and s.created_at > now() - interval '1 day'
  ) >= 5 or (
    select count(*) from pad.submissions s where s.created_at > now() - interval '10 minutes'
  ) >= 40 then
    raise exception 'submit_rate_limited';
  end if;

  insert into pad.submissions (
    id, visitor_id, name, email, chapter, testimonial, consent,
    file_path, poster_path, file_mime, file_bytes, duration_seconds, status
  ) values (
    v_id, p_visitor_id, v_name, v_email, v_chapter, v_testimonial, true,
    v_path, v_poster, case when v_has_file then p_file_mime end, case when v_has_file then p_file_bytes end,
    case when v_has_file then round(p_duration_seconds, 1) end,
    case when v_has_file then 'pending_upload' else 'received' end
  );

  return query select v_id, v_path, v_poster;
end;
$$;


commit;
