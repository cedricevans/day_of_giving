-- Admin-controlled kickoff video above the scoreboard. One settings row.
-- Visitors never read the table: kickoff_video() hands back the link only
-- while the admin has it turned on, so the URL can be staged early.
create table pad.site_settings (
  id int primary key default 1 check (id = 1),
  kickoff_video_url text,
  kickoff_video_on boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into pad.site_settings (id) values (1);

alter table pad.site_settings enable row level security;

create policy "authenticated can manage site settings"
  on pad.site_settings for all to authenticated
  using (true) with check (true);

grant select, update on pad.site_settings to authenticated;
grant all on pad.site_settings to service_role;

create function pad.kickoff_video()
returns text
language sql
stable
security definer
set search_path = pad
as $$
  select kickoff_video_url from pad.site_settings where id = 1 and kickoff_video_on
$$;

revoke all on function pad.kickoff_video() from public;
grant execute on function pad.kickoff_video() to anon, authenticated, service_role;
