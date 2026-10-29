-- Lets signed-in admins upload a replacement video and poster for an
-- existing story from the Submissions admin. Visitors still upload only to
-- the reserved path start_submission hands out.
create policy "pad admins upload submissions"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pad-submissions'
    and (name like 'videos/%' or name like 'posters/%')
  );
