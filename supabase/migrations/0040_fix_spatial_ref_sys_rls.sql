-- Supabase's Security Advisor flagged "RLS Disabled in Public" on
-- public.spatial_ref_sys — not an app table LastBite created (confirmed by
-- auditing every 0001-0039 migration: every create table has a matching
-- enable row level security in the same file). spatial_ref_sys is a system
-- reference table auto-created by the PostGIS extension itself (this
-- project uses PostGIS for geo search, see stores.geog/addresses.geog) — it
-- only holds public spatial-reference-system definitions (EPSG codes etc.),
-- not any user/business data, so this was never an actual data exposure.
-- Still worth silencing properly rather than ignoring: enable RLS with a
-- permissive read-only policy, exactly Supabase's own documented fix for
-- this common PostGIS-project case.
alter table public.spatial_ref_sys enable row level security;

create policy spatial_ref_sys_public_read on public.spatial_ref_sys
  for select using (true);
