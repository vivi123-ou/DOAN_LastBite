-- LastBite — seed data. Safe to re-run (upserts by unique slug).
-- Categories are deliberately restricted to the allowed combo types per
-- .claude/rules/business-rules.md: drinks, snacks/desserts, cooked/prepared
-- food only — never raw perishable ingredients.

-- Default lock durations reflect realistic shelf life per category, not a
-- flat number for everything — a sealed drink genuinely keeps far longer
-- than hot cooked food in Vietnam's climate (business-rules.md's mandatory
-- "never later than the category's own suggested time" cap is unchanged;
-- only what each category suggests was revisited here, see 0038's own
-- comment for the live bug report that prompted this).
insert into categories (name, slug, default_lock_duration_minutes) values
  ('Trà sữa & nước uống', 'tra-sua-nuoc-uong', 480),
  ('Cà phê', 'ca-phe', 480),
  ('Bánh ngọt & tráng miệng', 'banh-ngot-trang-mieng', 360),
  ('Đồ nướng', 'do-nuong', 240),
  ('Cơm & đồ ăn chín', 'com-do-an-chin', 180),
  ('Đồ ăn vặt', 'do-an-vat', 300)
on conflict (slug) do update set
  name = excluded.name,
  default_lock_duration_minutes = excluded.default_lock_duration_minutes;

-- Placeholder CO2-avoided-per-combo estimates (kg), used by the phase-3 Net
-- Zero tracker. Adjust once real figures are available; kept in a table
-- (not hardcoded in app code) specifically so this is a data change, not a
-- code change.
insert into co2_factors (category_id, kg_co2_per_combo)
select id, case slug
  when 'tra-sua-nuoc-uong' then 0.35
  when 'ca-phe' then 0.30
  when 'banh-ngot-trang-mieng' then 0.45
  when 'do-nuong' then 0.90
  when 'com-do-an-chin' then 0.70
  when 'do-an-vat' then 0.40
  else 0.5
end
from categories
where not exists (select 1 from co2_factors f where f.category_id = categories.id);
