-- Scoreboard, community Wall, chapter leaderboard, and quick polls.
--
-- Anonymous visitors never touch these tables directly. Every public read
-- and write goes through a security definer function below, which is where
-- validation, the blocked-word filter, and rate limits live, so none of it
-- can be skipped by calling the REST API directly. Admins (authenticated)
-- manage the tables directly, same as the existing donations table.
--
-- Wall posts publish immediately (no pre-approval). Admins can hide a post
-- after the fact, and the blocked_words list rejects posts at submit time.
--
-- "visitor_id" is a random id the browser keeps in localStorage. It is not
-- an identity, just enough to stop double reactions and to rate limit.

alter table pad.donations add column if not exists chapter text;

-- Official chapter list for the picker's suggestions. Starts empty; free
-- text is accepted until PAD provides the list.
create table if not exists pad.chapters (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null unique check (char_length(name) between 2 and 120)
);

-- Lowercase letters, digits and spaces only, so each entry is safe to drop
-- into a regex without escaping. Multi-word entries match as phrases.
create table if not exists pad.blocked_words (
  word text primary key check (word ~ '^[a-z0-9 ]{2,40}$'),
  created_at timestamptz not null default now()
);

insert into pad.blocked_words (word) values
  ('fuck'), ('fucking'), ('fucker'), ('motherfucker'), ('shit'), ('bullshit'),
  ('bitch'), ('bastard'), ('asshole'), ('dick'), ('cock'), ('pussy'), ('cunt'),
  ('whore'), ('slut'), ('fag'), ('faggot'), ('nigger'), ('nigga'), ('retard'),
  ('porn'), ('viagra'), ('casino'), ('crypto'), ('bitcoin')
on conflict do nothing;

create table if not exists pad.wall_posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  visitor_id uuid not null,
  display_name text check (char_length(display_name) <= 60),
  chapter text check (char_length(chapter) <= 120),
  message text not null check (char_length(message) between 3 and 280),
  kind text not null default 'why_i_give' check (kind in ('why_i_give', 'shout_out', 'memory')),
  status text not null default 'published' check (status in ('published', 'hidden')),
  hidden_reason text
);

create index if not exists wall_posts_feed_idx on pad.wall_posts (status, created_at desc);
create index if not exists wall_posts_visitor_idx on pad.wall_posts (visitor_id, created_at desc);

create table if not exists pad.wall_reactions (
  post_id uuid not null references pad.wall_posts (id) on delete cascade,
  visitor_id uuid not null,
  emoji text not null check (emoji in ('clap', 'heart', 'fire', 'scales')),
  created_at timestamptz not null default now(),
  primary key (post_id, visitor_id, emoji)
);

create table if not exists pad.polls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  question text not null check (char_length(question) between 5 and 200),
  options text[] not null check (array_length(options, 1) between 2 and 8),
  is_active boolean not null default true,
  sort_order integer not null default 0
);

create table if not exists pad.poll_votes (
  poll_id uuid not null references pad.polls (id) on delete cascade,
  visitor_id uuid not null,
  option_index integer not null check (option_index >= 0),
  created_at timestamptz not null default now(),
  primary key (poll_id, visitor_id)
);

insert into pad.polls (question, options, sort_order)
select 'Which P.A.D. value moves you to give?',
       array['Compassion', 'Courage', 'Diversity', 'Innovation', 'Integrity', 'Professionalism', 'Service'],
       0
where not exists (select 1 from pad.polls);

-- Helpers ------------------------------------------------------------------

create or replace function pad.normalize_chapter(p text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g'), '')
$$;

-- Checks the raw text and a de-leetspeaked copy (0->o, 1->i, 3->e, 4/@->a,
-- 5/$->s) against blocked_words on word boundaries, so "class" never trips
-- "ass" but "a$$hole" still trips "asshole".
create or replace function pad.is_clean(p text)
returns boolean
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select not exists (
    select 1
    from pad.blocked_words w
    where lower(coalesce(p, '')) ~ ('\m' || w.word || '\M')
       or translate(lower(coalesce(p, '')), '01345@$', 'oieasas') ~ ('\m' || w.word || '\M')
  )
$$;

-- Wall ---------------------------------------------------------------------

create or replace function pad.post_to_wall(
  p_visitor_id uuid,
  p_display_name text,
  p_chapter text,
  p_message text,
  p_kind text
)
returns table (
  id uuid,
  created_at timestamptz,
  display_name text,
  chapter text,
  message text,
  kind text
)
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
declare
  v_name text := nullif(regexp_replace(btrim(coalesce(p_display_name, '')), '\s+', ' ', 'g'), '');
  v_chapter text := pad.normalize_chapter(p_chapter);
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
  v_kind text := coalesce(nullif(p_kind, ''), 'why_i_give');
begin
  if p_visitor_id is null then
    raise exception 'wall_missing_visitor';
  end if;
  if v_message is null or char_length(v_message) < 3 then
    raise exception 'wall_message_too_short';
  end if;
  if char_length(v_message) > 280 or char_length(coalesce(v_name, '')) > 60 or char_length(coalesce(v_chapter, '')) > 120 then
    raise exception 'wall_too_long';
  end if;
  if v_kind not in ('why_i_give', 'shout_out', 'memory') then
    raise exception 'wall_bad_kind';
  end if;
  if concat_ws(' ', v_name, v_chapter, v_message) ~* '(https?://|www\.)' then
    raise exception 'wall_links_not_allowed';
  end if;
  if not pad.is_clean(concat_ws(' ', v_name, v_chapter, v_message)) then
    raise exception 'wall_blocked_words';
  end if;
  if exists (
    select 1 from pad.wall_posts wp
    where wp.visitor_id = p_visitor_id and wp.created_at > now() - interval '30 seconds'
  ) or (
    select count(*) from pad.wall_posts wp
    where wp.visitor_id = p_visitor_id and wp.created_at > now() - interval '1 day'
  ) >= 10 or (
    select count(*) from pad.wall_posts wp where wp.created_at > now() - interval '1 minute'
  ) >= 60 then
    raise exception 'wall_rate_limited';
  end if;

  return query
  insert into pad.wall_posts as wp (visitor_id, display_name, chapter, message, kind)
  values (p_visitor_id, v_name, v_chapter, v_message, v_kind)
  returning wp.id, wp.created_at, wp.display_name, wp.chapter, wp.message, wp.kind;
end;
$$;

create or replace function pad.wall_feed(
  p_visitor_id uuid,
  p_limit integer default 30,
  p_before timestamptz default null
)
returns table (
  id uuid,
  created_at timestamptz,
  display_name text,
  chapter text,
  message text,
  kind text,
  reactions jsonb,
  mine text[]
)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select
    p.id,
    p.created_at,
    p.display_name,
    p.chapter,
    p.message,
    p.kind,
    coalesce(
      (select jsonb_object_agg(x.emoji, x.n)
       from (select r.emoji, count(*) as n from pad.wall_reactions r where r.post_id = p.id group by r.emoji) x),
      '{}'::jsonb
    ),
    coalesce(
      (select array_agg(r.emoji) from pad.wall_reactions r where r.post_id = p.id and r.visitor_id = p_visitor_id),
      '{}'::text[]
    )
  from pad.wall_posts p
  where p.status = 'published'
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 50)
$$;

-- Returns true when the reaction is now on, false when it was removed.
create or replace function pad.toggle_wall_reaction(p_post_id uuid, p_visitor_id uuid, p_emoji text)
returns boolean
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
begin
  if p_visitor_id is null or p_emoji not in ('clap', 'heart', 'fire', 'scales') then
    raise exception 'wall_bad_reaction';
  end if;
  if not exists (select 1 from pad.wall_posts wp where wp.id = p_post_id and wp.status = 'published') then
    raise exception 'wall_post_not_found';
  end if;

  delete from pad.wall_reactions r
  where r.post_id = p_post_id and r.visitor_id = p_visitor_id and r.emoji = p_emoji;
  if found then
    return false;
  end if;

  insert into pad.wall_reactions (post_id, visitor_id, emoji)
  values (p_post_id, p_visitor_id, p_emoji)
  on conflict do nothing;
  return true;
end;
$$;

-- Polls --------------------------------------------------------------------

create or replace function pad.active_polls(p_visitor_id uuid)
returns table (
  id uuid,
  question text,
  options text[],
  counts integer[],
  total integer,
  my_vote integer
)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select
    p.id,
    p.question,
    p.options,
    array(
      select count(v.visitor_id)::int
      from generate_series(0, array_length(p.options, 1) - 1) as i
      left join pad.poll_votes v on v.poll_id = p.id and v.option_index = i
      group by i
      order by i
    ),
    (select count(*)::int from pad.poll_votes v where v.poll_id = p.id),
    (select v.option_index from pad.poll_votes v where v.poll_id = p.id and v.visitor_id = p_visitor_id)
  from pad.polls p
  where p.is_active
  order by p.sort_order, p.created_at
$$;

create or replace function pad.vote_poll(p_poll_id uuid, p_visitor_id uuid, p_option_index integer)
returns void
language plpgsql
volatile
security definer
set search_path = pad, pg_temp
as $$
begin
  if p_visitor_id is null or not exists (
    select 1 from pad.polls p
    where p.id = p_poll_id and p.is_active
      and p_option_index between 0 and array_length(p.options, 1) - 1
  ) then
    raise exception 'poll_bad_vote';
  end if;

  insert into pad.poll_votes (poll_id, visitor_id, option_index)
  values (p_poll_id, p_visitor_id, p_option_index)
  on conflict (poll_id, visitor_id)
  do update set option_index = excluded.option_index, created_at = now();
end;
$$;

-- Scoreboard ---------------------------------------------------------------
--
-- Dollars and donor counts come only from pad.donations (entered by admins
-- from the YM export). "Chapters participating" also counts chapters named
-- on Give clicks and Wall posts, since those are the only chapter signal
-- until YM captures it on the gift itself.

create or replace function pad.chapter_mentions()
returns table (chapter text, amount_cents bigint, source text, who text)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select pad.normalize_chapter(d.chapter), d.amount_cents::bigint, 'gift', d.id::text
  from pad.donations d
  where d.chapter is not null
  union all
  select pad.normalize_chapter(w.chapter), 0, 'post', w.visitor_id::text
  from pad.wall_posts w
  where w.status = 'published' and w.chapter is not null
  union all
  select pad.normalize_chapter(e.metadata ->> 'chapter'), 0, 'click',
         coalesce(e.metadata ->> 'visitor_id', e.session_id::text, e.id::text)
  from pad.events e
  where e.event_type = 'donate_click' and e.metadata ? 'chapter'
$$;

revoke execute on function pad.chapter_mentions() from public, anon, authenticated;

create or replace function pad.scoreboard()
returns table (
  raised_cents bigint,
  gift_count integer,
  donor_count integer,
  chapters_participating integer,
  wall_posts integer,
  last_recorded_at timestamptz
)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select
    (select coalesce(sum(d.amount_cents), 0)::bigint from pad.donations d),
    (select count(*)::int from pad.donations d),
    (select count(distinct coalesce(lower(nullif(btrim(d.donor_email), '')), lower(nullif(btrim(d.donor_name), '')), d.id::text))::int
     from pad.donations d),
    (select count(distinct lower(m.chapter))::int
     from pad.chapter_mentions() m
     where m.chapter is not null and char_length(m.chapter) <= 120 and pad.is_clean(m.chapter)),
    (select count(*)::int from pad.wall_posts w where w.status = 'published'),
    (select max(d.created_at) from pad.donations d)
$$;

create or replace function pad.chapter_leaderboard(p_limit integer default 10)
returns table (
  chapter text,
  raised_cents bigint,
  gifts integer,
  supporters integer,
  posts integer
)
language sql
stable
security definer
set search_path = pad, pg_temp
as $$
  select
    coalesce(
      (select c.name from pad.chapters c where lower(c.name) = lower(m.chapter_key) limit 1),
      mode() within group (order by m.chapter)
    ),
    coalesce(sum(m.amount_cents), 0)::bigint,
    (count(*) filter (where m.source = 'gift'))::int,
    (count(distinct m.who) filter (where m.source in ('post', 'click')))::int,
    (count(*) filter (where m.source = 'post'))::int
  from (select cm.*, lower(cm.chapter) as chapter_key from pad.chapter_mentions() cm) m
  where m.chapter is not null and char_length(m.chapter) <= 120 and pad.is_clean(m.chapter)
  group by m.chapter_key
  order by 2 desc, 4 desc, 5 desc
  limit least(greatest(coalesce(p_limit, 10), 1), 25)
$$;

-- Access -------------------------------------------------------------------

alter table pad.chapters enable row level security;
alter table pad.blocked_words enable row level security;
alter table pad.wall_posts enable row level security;
alter table pad.wall_reactions enable row level security;
alter table pad.polls enable row level security;
alter table pad.poll_votes enable row level security;

create policy "anyone can read chapters" on pad.chapters
  for select to anon, authenticated using (true);
create policy "authenticated can manage chapters" on pad.chapters
  for all to authenticated using (true) with check (true);
create policy "authenticated can manage blocked words" on pad.blocked_words
  for all to authenticated using (true) with check (true);
create policy "authenticated can manage wall posts" on pad.wall_posts
  for all to authenticated using (true) with check (true);
create policy "authenticated can read wall reactions" on pad.wall_reactions
  for select to authenticated using (true);
create policy "authenticated can manage polls" on pad.polls
  for all to authenticated using (true) with check (true);
create policy "authenticated can read poll votes" on pad.poll_votes
  for select to authenticated using (true);

grant select on pad.chapters to anon;
grant select, insert, update, delete on pad.chapters to authenticated;
grant select, insert, update, delete on pad.blocked_words to authenticated;
grant select, update, delete on pad.wall_posts to authenticated;
grant select on pad.wall_reactions to authenticated;
grant select, insert, update, delete on pad.polls to authenticated;
grant select on pad.poll_votes to authenticated;

grant execute on function pad.post_to_wall(uuid, text, text, text, text) to anon, authenticated;
grant execute on function pad.wall_feed(uuid, integer, timestamptz) to anon, authenticated;
grant execute on function pad.toggle_wall_reaction(uuid, uuid, text) to anon, authenticated;
grant execute on function pad.active_polls(uuid) to anon, authenticated;
grant execute on function pad.vote_poll(uuid, uuid, integer) to anon, authenticated;
grant execute on function pad.scoreboard() to anon, authenticated;
grant execute on function pad.chapter_leaderboard(integer) to anon, authenticated;
