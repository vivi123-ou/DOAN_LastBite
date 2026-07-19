-- Additive migration (see .claude/rules/database-and-schema.md — 0001 is never edited).
--
-- Adds plain lat/lng columns alongside the existing PostGIS `geog` column on
-- stores and addresses. `geog` + its GiST index remains the only thing used
-- for spatial queries (KNN/ST_DWithin) — these plain columns exist purely so
-- the app can display/prefill a store's or address's coordinates without
-- parsing PostGIS's WKB text output through PostGREST. Both columns are
-- always written together from the same form input in
-- lib/repositories/store.repository.ts, so there is a single write path and
-- no drift between them.

alter table stores add column lat double precision;
alter table stores add column lng double precision;

alter table addresses add column lat double precision;
alter table addresses add column lng double precision;
