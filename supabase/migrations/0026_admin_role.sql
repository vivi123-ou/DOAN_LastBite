-- Additive migration (0001-0025 applied and never edited). Real /admin panel
-- to replace hand-editing Supabase Studio for store verification etc. —
-- direct user request, scoped to what's actually feasible now (store
-- approval/lock, system-wide combo monitoring, report handling, basic
-- analytics) after an explicit AskUserQuestion ruled out the much larger
-- subscription-billing/commission-payout/ads-management wishlist for this
-- round (documented as future roadmap in CLAUDE.md instead).

-- profiles.role gains 'admin' as a third value, alongside the existing
-- 'customer'/'store_owner' — same column this app already uses everywhere
-- for role-based branching, not a parallel authorization mechanism.
-- "if exists" defensively — profiles_role_check is Postgres's default
-- auto-generated name for the original unnamed inline check (0001), but if
-- it somehow differs, this drop is a no-op rather than an error, and the
-- add below still lands (just alongside a redundant identically-scoped old
-- constraint rather than replacing it).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('customer', 'store_owner', 'admin'));

-- Lets an admin mark a report as looked-at, with an optional note — nothing
-- like this existed before (0015_combo_reviews.sql only ever supported
-- customers filing a report, never anyone processing one). Nullable/no
-- default: a fresh report is simply "not yet resolved" (resolved_at is null),
-- no separate status column needed.
alter table combo_reviews
  add column resolved_at timestamptz,
  add column admin_note text;

-- No new RLS policies anywhere in this migration on purpose — every /admin
-- repository function (lib/repositories/admin.repository.ts) uses the
-- service-role client, same cross-actor posture already established for
-- payments/notifications (.claude/rules/database-and-schema.md). Admin
-- genuinely needs to read/act across every store and customer regardless of
-- RLS; access to the /admin route itself is gated at the app layer
-- (app/(admin)/admin/layout.tsx checking profiles.role = 'admin'), not by
-- loosening what a regular client can see.
