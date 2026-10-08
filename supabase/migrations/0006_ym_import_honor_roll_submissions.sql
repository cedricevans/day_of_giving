-- YM export import, public donor honor roll, and video/testimonial uploads.
--
-- Donations: the admin page parses YM's Ecommerce export in the browser and
-- upserts only the columns below (never card or address data). The YM
-- Transaction_ID makes re-importing an overlapping export safe.
--
-- Honor roll: only donors who ticked one of YM's consent boxes are listed,
-- and only their name and chapter, never amounts or emails.
--
-- Submissions: the free Supabase plan has 1 GB of storage and limited
-- egress, so the browser shrinks videos to 720p before upload, the bucket
-- caps each file at 50 MB, and pad.start_submission refuses new videos once
-- the bucket nears the quota below. Videos are never served publicly; admins
-- open them with short-lived signed URLs and remove them once downloaded.

alter table pad.donations add column if not exists ym_transaction_id text unique;
alter table pad.donations add column if not exists donated_at timestamptz;
alter table pad.donations add column if not exists fund text;
alter table pad.donations add column if not exists list_publicly boolean not null default false;

create or replace function pad.donor_honor_roll(p_limit integer default 120)
returns table (display_name text, chapter text, donated_at timestamptz)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select x.display_name, x.chapter, x.donated_at
  from (
    select distinct on (lower(btrim(d.donor_name)))
      btrim(d.donor_name) as display_name,
      pad.normalize_chapter(d.chapter) as chapter,
      coalesce(d.donated_at, d.created_at) as donated_at
    from pad.donations d
    where d.list_publicly and nullif(btrim(d.donor_name), '') is not null
    order by lower(btrim(d.donor_name)), coalesce(d.donated_at, d.created_at) desc
  ) x
  order by x.donated_at desc
  limit least(greatest(coalesce(p_limit, 120), 1), 500)
$$;

grant execute on function pad.donor_honor_roll(integer) to anon, authenticated;

-- Submissions --------------------------------------------------------------

create table if not exists pad.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) <= 200 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  chapter text check (char_length(chapter) <= 120),
  testimonial text check (char_length(testimonial) <= 1500),
  consent boolean not null check (consent),
  file_path text unique,
  file_mime text,
  file_bytes bigint check (file_bytes > 0),
  duration_seconds numeric(5, 1),
  status text not null default 'received'
    check (status in ('pending_upload', 'received', 'approved', 'file_removed')),
  check (testimonial is not null or file_path is not null)
);

create index if not exists submissions_created_idx on pad.submissions (created_at desc);
create index if not exists submissions_visitor_idx on pad.submissions (visitor_id, created_at desc);

alter table pad.submissions enable row level security;

create policy "authenticated can manage submissions" on pad.submissions
  for all to authenticated using (true) with check (true);

grant select, update, delete on pad.submissions to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'pad-submissions',
  'pad-submissions',
  false,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Bytes the bucket holds plus uploads reserved in the last hour that have
-- not landed yet.
create or replace function pad.submission_storage_bytes()
returns bigint
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select
    coalesce((select sum((o.metadata ->> 'size')::bigint) from storage.objects o
              where o.bucket_id = 'pad-submissions'), 0)
    + coalesce((select sum(s.file_bytes) from pad.submissions s
                where s.status = 'pending_upload' and s.created_at > now() - interval '1 hour'), 0)
$$;

revoke execute on function pad.submission_storage_bytes() from public, anon;
grant execute on function pad.submission_storage_bytes() to authenticated;

create or replace function pad.start_submission(
  p_visitor_id uuid,
  p_name text,
  p_email text,
  p_chapter text,
  p_testimonial text,
  p_consent boolean,
  p_file_bytes bigint,
  p_file_mime text,
  p_duration_seconds numeric
)
returns table (id uuid, file_path text)
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
declare
  c_max_file_bytes constant bigint := 52428800;   -- matches the bucket limit
  c_quota_bytes constant bigint := 838860800;     -- 800 MB of the plan's 1 GB
  v_name text := nullif(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g'), '');
  v_email text := lower(nullif(btrim(coalesce(p_email, '')), ''));
  v_chapter text := pad.normalize_chapter(p_chapter);
  v_testimonial text := nullif(btrim(coalesce(p_testimonial, '')), '');
  v_has_file boolean := p_file_bytes is not null;
  v_id uuid := gen_random_uuid();
  v_path text;
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
    if pad.submission_storage_bytes() + p_file_bytes > c_quota_bytes then
      raise exception 'submit_storage_full';
    end if;
    v_path := 'videos/' || v_id::text || case p_file_mime
      when 'video/webm' then '.webm'
      when 'video/quicktime' then '.mov'
      else '.mp4'
    end;
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
    file_path, file_mime, file_bytes, duration_seconds, status
  ) values (
    v_id, p_visitor_id, v_name, v_email, v_chapter, v_testimonial, true,
    v_path, case when v_has_file then p_file_mime end, case when v_has_file then p_file_bytes end,
    case when v_has_file then round(p_duration_seconds, 1) end,
    case when v_has_file then 'pending_upload' else 'received' end
  );

  return query select v_id, v_path;
end;
$$;

-- Storage insert check: the object name must be a reserved, not yet
-- uploaded path from start_submission in the last hour.
create or replace function pad.can_upload_submission(p_name text)
returns boolean
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select exists (
    select 1 from pad.submissions s
    where s.file_path = p_name
      and s.status = 'pending_upload'
      and s.created_at > now() - interval '1 hour'
  )
$$;

create or replace function pad.finish_submission(p_id uuid, p_visitor_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
declare
  v_path text;
  v_bytes bigint;
begin
  select s.file_path into v_path
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
  set status = 'received', file_bytes = v_bytes
  where s.id = p_id;
end;
$$;

grant execute on function pad.start_submission(uuid, text, text, text, text, boolean, bigint, text, numeric) to anon, authenticated;
grant execute on function pad.can_upload_submission(text) to anon, authenticated;
grant execute on function pad.finish_submission(uuid, uuid) to anon, authenticated;

create policy "pad submissions upload reserved path" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'pad-submissions' and pad.can_upload_submission(name));

create policy "pad admins read submissions" on storage.objects
  for select to authenticated
  using (bucket_id = 'pad-submissions');

create policy "pad admins delete submissions" on storage.objects
  for delete to authenticated
  using (bucket_id = 'pad-submissions');
