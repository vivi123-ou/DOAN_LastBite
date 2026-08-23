-- Live bug report: a "Trà sữa" combo's suggested Best Before window was
-- only 2 hours (categories.default_lock_duration_minutes = 120), which the
-- user correctly flagged as unrealistically short for a sealed drink — the
-- mandatory business rule (.claude/rules/business-rules.md) that a store
-- can never set Best Before *later* than the category's own suggested time
-- is unchanged and non-negotiable (food-safety driven), but the *suggested
-- default itself* was simply too conservative for some categories and too
-- generous for none — revisited per-category, not replaced with one flat
-- number for everything (a sealed drink and a hot cooked rice dish
-- genuinely do not have the same real shelf life in Vietnam's climate).
--
-- Cơm & đồ ăn chín / Đồ nướng (hot cooked food) are deliberately left
-- unchanged — these are exactly the categories the food-safety rule exists
-- to protect, no reason to extend them further.
update categories set default_lock_duration_minutes = 480 where slug = 'tra-sua-nuoc-uong';
update categories set default_lock_duration_minutes = 480 where slug = 'ca-phe';
update categories set default_lock_duration_minutes = 360 where slug = 'banh-ngot-trang-mieng';
update categories set default_lock_duration_minutes = 300 where slug = 'do-an-vat';
