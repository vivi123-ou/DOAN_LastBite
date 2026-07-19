-- Additive migration (see .claude/rules/database-and-schema.md).
--
-- Storage bucket for real combo photos (never a "mystery bag" — see
-- .claude/rules/business-rules.md). Objects are uploaded to
-- `${storeId}/${filename}`, so ownership can be checked by parsing the first
-- path segment back to a store and comparing against auth.uid().

insert into storage.buckets (id, name, public)
values ('combo-images', 'combo-images', true)
on conflict (id) do nothing;

create policy combo_images_bucket_public_read on storage.objects
  for select using (bucket_id = 'combo-images');

create policy combo_images_bucket_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'combo-images'
    and exists (
      select 1 from stores s
      where s.id = (storage.foldername(name))[1]::uuid
        and s.owner_id = auth.uid()
    )
  );

create policy combo_images_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'combo-images'
    and exists (
      select 1 from stores s
      where s.id = (storage.foldername(name))[1]::uuid
        and s.owner_id = auth.uid()
    )
  );
