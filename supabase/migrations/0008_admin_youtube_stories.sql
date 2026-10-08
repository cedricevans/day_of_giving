-- Lets admins add a story straight from a public YouTube link (no upload),
-- for example PAD's own videos. Admin-added rows use the admin's email as
-- the contact and a random visitor id; consent is the admin's call.

grant insert on pad.submissions to authenticated;

-- A YouTube-only story has neither a testimonial nor an uploaded file.
alter table pad.submissions drop constraint if exists submissions_check;
alter table pad.submissions add constraint submissions_has_content
  check (testimonial is not null or file_path is not null or youtube_id is not null);
