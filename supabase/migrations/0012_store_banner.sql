-- Additive migration (0001-0011 applied and never edited). Adds a banner
-- image for the store — separate from the existing `logo_url` (small
-- square brand mark) since the map's store detail panel
-- (components/map/store-detail-panel.tsx) needs a large wide banner image
-- up top, distinct from the logo shown elsewhere (header/cards, if ever
-- used there). No RLS changes needed: stores_select_public/_own and
-- stores_update_own (0001) already cover every column on the row, not
-- specific columns.

alter table stores add column banner_url text;
