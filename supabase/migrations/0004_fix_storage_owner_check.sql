-- Additive migration (see .claude/rules/database-and-schema.md).
--
-- The combo-images storage policies from 0003 embedded a subquery against
-- public.stores directly inside storage.objects' RLS check. stores has its
-- own RLS policies, and nested RLS evaluation across schemas inside the
-- Storage service's request context was rejecting inserts even when
-- auth.uid() correctly matched stores.owner_id (confirmed via direct DB
-- inspection). Wrapping the ownership check in a SECURITY DEFINER function
-- evaluates it with the function owner's privileges, bypassing stores' RLS
-- for this specific, narrowly-scoped check — the standard Supabase-
-- recommended pattern for storage policies that need to consult another
-- table.

create or replace function storage_combo_image_owner(object_name text)
returns boolean
language sql
security definer
stable
set search_path = public, storage
as $$
  select exists (
    select 1 from stores s
    where s.id = (storage.foldername(object_name))[1]::uuid
      and s.owner_id = auth.uid()
  );
$$;

drop policy if exists combo_images_bucket_owner_write on storage.objects;
create policy combo_images_bucket_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'combo-images'
    and storage_combo_image_owner(name)
  );

drop policy if exists combo_images_bucket_owner_delete on storage.objects;
create policy combo_images_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'combo-images'
    and storage_combo_image_owner(name)
  );
