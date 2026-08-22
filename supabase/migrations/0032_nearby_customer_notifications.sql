-- Phase 3's last remaining item: "combo went active near you" notifications
-- (.claude/rules/stack-and-conventions.md's own Observer/event-bus example,
-- lib/events/event-bus.ts, was scaffolded for exactly this back in phase 1
-- planning and never wired to a publisher until now).
--
-- The only persisted per-customer location this schema has is `addresses`
-- (populated today only when a customer places a delivery order — see
-- order.repository.ts's create()). There is no separate "home location"/
-- saved-address book (CLAUDE.md's phase-2 notes: deliberately the smallest
-- slice, one inline address per delivery order). So "nearby customers" here
-- means "customers who have at least one delivery address within radius of
-- this store" — a real, honest signal, just not a complete one: a
-- pickup-only customer who has never placed a delivery order has no address
-- on file and will never receive a proximity notification. Documented
-- limitation, not a bug — same "no signal, no fabricated result" posture
-- already used for the homepage's "Có thể bạn thích" section.
--
-- Plain SQL function (not SECURITY DEFINER) — the only caller is the
-- notify-nearby-customers event handler, which always runs on the
-- service-role admin client (server-side, triggered when a combo goes
-- active), so RLS never applies to this call regardless.
create or replace function nearby_customer_ids(
  in_lat double precision,
  in_lng double precision,
  radius_m integer default 10000
) returns table (user_id uuid)
language sql
stable
as $$
  select distinct a.user_id
  from addresses a
  where ST_DWithin(a.geog, ST_SetSRID(ST_MakePoint(in_lng, in_lat), 4326)::geography, radius_m);
$$;
