-- Additive migration (see .claude/rules/database-and-schema.md — 0001-0006
-- are never edited).
--
-- Storage bucket for user avatars. Objects are uploaded to
-- `${userId}/${filename}`, so ownership is a direct match against
-- auth.uid() — unlike combo-images (0003), this doesn't need a
-- SECURITY DEFINER wrapper: there's no cross-table ownership join here,
-- just the uploader's own id against the path.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy avatars_bucket_public_read on storage.objects
  for select using (bucket_id = 'avatars');

create policy avatars_bucket_own_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy avatars_bucket_own_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
