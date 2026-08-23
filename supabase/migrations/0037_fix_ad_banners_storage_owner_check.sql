-- Real bug, a repeat of one already fixed once before in this exact
-- codebase: 0035_ad_placements.sql's ad-banners storage policies embedded a
-- subquery against public.stores directly inside storage.objects' RLS
-- check — the same shape 0003's original combo-images policies used, which
-- 0004_fix_storage_owner_check.sql already diagnosed and fixed. `stores`
-- has its own RLS policies, and nested RLS evaluation across schemas
-- inside the Storage service's request context rejects the insert even
-- when auth.uid() correctly matches stores.owner_id. Live-caught: the
-- store owner uploading a "Banner trang chủ" ad image got a generic "Tải
-- ảnh lên thất bại" every time.
--
-- Fix, identical in shape to 0004's: wrap the ownership check in a
-- SECURITY DEFINER function, which evaluates with the function owner's
-- privileges and bypasses stores' RLS for this one narrowly-scoped check —
-- the standard Supabase-recommended pattern for storage policies that need
-- to consult another table. Reuses the exact same check
-- storage_combo_image_owner() already does (both buckets key objects by
-- `${storeId}/...`), but as its own function rather than repurposing a
-- function literally named for combo images — reads correctly for anyone
-- auditing the ad-banners policies later.
create or replace function storage_ad_banner_owner(object_name text)
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

drop policy if exists ad_banners_bucket_owner_write on storage.objects;
create policy ad_banners_bucket_owner_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'ad-banners'
    and storage_ad_banner_owner(name)
  );

drop policy if exists ad_banners_bucket_owner_delete on storage.objects;
create policy ad_banners_bucket_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'ad-banners'
    and storage_ad_banner_owner(name)
  );
