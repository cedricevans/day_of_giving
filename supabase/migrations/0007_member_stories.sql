-- Member Stories: admins choose which submissions appear on the landing page.
--
-- Nothing is public until an admin turns on `on_site`. Each video gets a
-- small JPEG poster captured in the sender's browser, so the page shows
-- posters and only fetches a video when a visitor taps play. An admin can
-- also paste a YouTube link, and the page then plays it from YouTube and
-- spends no Supabase egress at all.
--
-- Egress: Supabase egress is shared by every app in this project, so video
-- plays from storage have a hard monthly budget. Each play goes through
-- pad.start_story_play, which logs the file's size and refuses once the
-- month's total reaches c_budget_bytes in pad.story_video_budget_left().
-- Anon can only sign a video URL in the two minutes after a logged play,
-- so the budget can't be skipped by calling the Storage API directly.
-- Posters stay readable for stories on the site; they are ~20 KB each.

alter table pad.submissions add column if not exists poster_path text unique;
alter table pad.submissions add column if not exists on_site boolean not null default false;
alter table pad.submissions add column if not exists published_at timestamptz;
alter table pad.submissions add column if not exists youtube_id text
  check (youtube_id ~ '^[A-Za-z0-9_-]{11}$');

update storage.buckets
set allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v', 'image/jpeg']
where id = 'pad-submissions';

-- The old signature is dropped so PostgREST has one function to resolve.
-- p_poster_bytes defaults to null, so callers that don't send it still work.
drop function if exists pad.start_submission(uuid, text, text, text, text, boolean, bigint, text, numeric);

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
    if p_duration_seconds is null or p_duration_seconds > 30 then
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

grant execute on function pad.start_submission(uuid, text, text, text, text, boolean, bigint, text, numeric, bigint) to anon, authenticated;

create or replace function pad.can_upload_submission(p_name text)
returns boolean
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select exists (
    select 1 from pad.submissions s
    where (s.file_path = p_name or s.poster_path = p_name)
      and s.status = 'pending_upload'
      and s.created_at > now() - interval '1 hour'
  )
$$;

-- A missing poster is not an error; the page falls back to a plain tile.
create or replace function pad.finish_submission(p_id uuid, p_visitor_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
declare
  v_path text;
  v_poster text;
  v_bytes bigint;
begin
  select s.file_path, s.poster_path into v_path, v_poster
  from pad.submissions s
  where s.id = p_id and s.visitor_id = p_visitor_id and s.status = 'pending_upload';
  if v_path is null then
    raise exception 'submit_not_found';
  end if;

  select (o.metadata ->> 'size')::bigint into v_bytes
  from storage.objects o
  where o.bucket_id = 'pad-submissions' and o.name = v_path;
  if v_bytes is null then
    raise exception 'submit_upload_missing';
  end if;

  update pad.submissions s
  set status = 'received',
      file_bytes = v_bytes,
      poster_path = case
        when exists (select 1 from storage.objects o where o.bucket_id = 'pad-submissions' and o.name = v_poster)
        then v_poster
      end
  where s.id = p_id;
end;
$$;

create table if not exists pad.story_plays (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  submission_id uuid not null references pad.submissions (id) on delete cascade,
  visitor_id uuid not null,
  bytes bigint not null
);

create index if not exists story_plays_month_idx on pad.story_plays (created_at);
create index if not exists story_plays_visitor_idx on pad.story_plays (visitor_id, created_at desc);

alter table pad.story_plays enable row level security;

create policy "authenticated can read story plays" on pad.story_plays
  for select to authenticated using (true);

grant select on pad.story_plays to authenticated;

create or replace function pad.story_video_egress_this_month()
returns bigint
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select coalesce(sum(p.bytes), 0)::bigint
  from pad.story_plays p
  where p.created_at >= date_trunc('month', now())
$$;

create or replace function pad.story_video_budget_left()
returns bigint
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select 1610612736 - pad.story_video_egress_this_month()   -- 1.5 GB per month
$$;

revoke execute on function pad.story_video_egress_this_month() from public, anon;
revoke execute on function pad.story_video_budget_left() from public, anon;
grant execute on function pad.story_video_egress_this_month() to authenticated;
grant execute on function pad.story_video_budget_left() to authenticated;

-- Returns true when the visitor may stream this story's video now.
create or replace function pad.start_story_play(p_id uuid, p_visitor_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
declare
  v_bytes bigint;
begin
  select s.file_bytes into v_bytes
  from pad.submissions s
  where s.id = p_id and s.on_site and s.status <> 'file_removed'
    and s.file_path is not null and s.youtube_id is null;
  if v_bytes is null or p_visitor_id is null then
    return false;
  end if;
  if pad.story_video_budget_left() < v_bytes then
    return false;
  end if;
  if (
    select count(*) from pad.story_plays p
    where p.visitor_id = p_visitor_id and p.created_at > now() - interval '1 hour'
  ) >= 20 then
    return false;
  end if;

  insert into pad.story_plays (submission_id, visitor_id, bytes) values (p_id, p_visitor_id, v_bytes);
  return true;
end;
$$;

grant execute on function pad.start_story_play(uuid, uuid) to anon, authenticated;

create or replace function pad.is_public_story_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select exists (
    select 1 from pad.submissions s
    where s.on_site
      and s.status <> 'file_removed'
      and (
        s.poster_path = p_name
        or (s.file_path = p_name and exists (
          select 1 from pad.story_plays p
          where p.submission_id = s.id and p.created_at > now() - interval '2 minutes'
        ))
      )
  )
$$;

grant execute on function pad.is_public_story_object(text) to anon, authenticated;

create policy "pad public stories readable" on storage.objects
  for select to anon
  using (bucket_id = 'pad-submissions' and pad.is_public_story_object(name));

create or replace function pad.member_stories(p_limit integer default 24)
returns table (
  id uuid,
  name text,
  chapter text,
  testimonial text,
  video_path text,
  poster_path text,
  youtube_id text,
  published_at timestamptz,
  video_available boolean
)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select
    s.id,
    s.name,
    s.chapter,
    s.testimonial,
    case when s.status <> 'file_removed' then s.file_path end,
    case when s.status <> 'file_removed' then s.poster_path end,
    s.youtube_id,
    s.published_at,
    s.youtube_id is null and s.file_path is not null and s.status <> 'file_removed'
      and pad.story_video_budget_left() >= coalesce(s.file_bytes, 0)
  from pad.submissions s
  where s.on_site
    and (s.testimonial is not null or s.youtube_id is not null
         or (s.file_path is not null and s.status <> 'file_removed'))
  order by s.published_at desc nulls last, s.created_at desc
  limit least(greatest(coalesce(p_limit, 24), 1), 60)
$$;

grant execute on function pad.member_stories(integer) to anon, authenticated;
