-- Additive migration (0001-0012 applied and never edited). Contact phone
-- number for the store — shown on the store-info edit page and on the
-- map's store detail panel (store-detail-panel.tsx), per explicit request
-- for a way for customers to actually reach the store. No RLS changes
-- needed: stores_update_own/_select_public (0001) are row-level, not
-- column-scoped.

alter table stores add column phone text;
