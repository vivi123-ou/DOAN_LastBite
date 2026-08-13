import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { NetZeroExpiry, NetZeroSummary } from "@/lib/domain/net-zero";
import { calculatePointsEarned } from "@/lib/pricing/net-zero/net-zero.policy";

// Points expire this many days after being earned — see
// 0022_net_zero_points_expiry.sql. A named constant, same "tunable business
// policy, not hardcoded logic" spirit as net-zero.policy.ts's own rates.
const EXPIRY_DAYS = 365;

// profiles_select_own / net_zero_ledger_select_own RLS (0001) already scope
// both reads to the signed-in user's own rows — regular client.
export async function getSummary(
  client: SupabaseClient<Database>,
  userId: string
): Promise<NetZeroSummary> {
  const [{ data: profile, error: profileError }, { data: ledgerRows, error: ledgerError }] =
    await Promise.all([
      client.from("profiles").select("net_zero_points").eq("id", userId).maybeSingle(),
      client.from("net_zero_ledger").select("co2_saved_kg").eq("user_id", userId),
    ]);
  if (profileError) throw profileError;
  if (ledgerError) throw ledgerError;

  return {
    pointsBalance: profile?.net_zero_points ?? 0,
    totalCo2SavedKg: (ledgerRows ?? []).reduce((sum, row) => sum + row.co2_saved_kg, 0),
  };
}

// profiles.net_zero_points is a running balance (read-then-write, not an
// atomic increment — same "no row-locking Postgres function" tradeoff
// order.builder.ts already documents for stock). Always called with the
// admin client: every caller is either a cross-actor write (checkout
// deducting points, a store owner's rejection refunding a customer's
// points) or part of an already-fully-admin-client flow (markPaid(), which
// established the "one consistent client for the whole flow" pattern —
// see group-buy.repository.ts's create() for the same reasoning).
export async function adjustBalance(
  adminClient: SupabaseClient<Database>,
  userId: string,
  delta: number
): Promise<void> {
  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("net_zero_points")
    .eq("id", userId)
    .single();
  if (error) throw error;

  const next = Math.max(0, profile.net_zero_points + delta);
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ net_zero_points: next })
    .eq("id", userId);
  if (updateError) throw updateError;
}

// Called once from order.repository.ts's markPaid() — computes both halves
// of "Net Zero" for this order: kg CO2 avoided (co2_factors × quantity per
// line, written to the pre-existing but previously-unused net_zero_ledger)
// and points earned (calculatePointsEarned(), credited to the balance).
export async function recordOrderImpact(
  adminClient: SupabaseClient<Database>,
  orderId: string,
  customerId: string,
  totalAmount: number
): Promise<{ pointsEarned: number; co2SavedKg: number }> {
  const { data: items, error: itemsError } = await adminClient
    .from("order_items")
    .select("combo_id, quantity")
    .eq("order_id", orderId);
  if (itemsError) throw itemsError;

  let co2SavedKg = 0;
  if (items.length > 0) {
    const comboIds = items.map((i) => i.combo_id);
    const { data: combos, error: combosError } = await adminClient
      .from("combos")
      .select("id, category_id")
      .in("id", comboIds);
    if (combosError) throw combosError;

    const categoryIds = [...new Set(combos.map((c) => c.category_id))];
    const { data: factors, error: factorsError } = await adminClient
      .from("co2_factors")
      .select("category_id, kg_co2_per_combo")
      .in("category_id", categoryIds);
    if (factorsError) throw factorsError;

    const categoryByCombo = new Map(combos.map((c) => [c.id, c.category_id]));
    const factorByCategory = new Map(factors.map((f) => [f.category_id, f.kg_co2_per_combo]));

    for (const item of items) {
      const categoryId = categoryByCombo.get(item.combo_id);
      const factor = categoryId ? (factorByCategory.get(categoryId) ?? 0) : 0;
      co2SavedKg += factor * item.quantity;
    }
  }

  const pointsEarned = calculatePointsEarned(totalAmount);

  const { error: ledgerError } = await adminClient.from("net_zero_ledger").insert({
    user_id: customerId,
    order_id: orderId,
    co2_saved_kg: co2SavedKg,
    points_earned: pointsEarned,
  });
  if (ledgerError) throw ledgerError;

  if (pointsEarned > 0) {
    await adjustBalance(adminClient, customerId, pointsEarned);
  }

  return { pointsEarned, co2SavedKg };
}

// Display-only — how many points/kg CO2 *this specific order* earned, for
// orders/[id]/page.tsx's receipt. Regular client is fine (net_zero_ledger's
// own select-own RLS, 0001, already scopes it to the caller's own rows) —
// same read-only posture as getSummary()/getNextExpiry(). Returns null both
// when the order genuinely earned nothing (pointsEarned/co2SavedKg both 0 —
// shouldn't happen for a real paid order, but not an error either way) and
// when no ledger row exists at all yet (unpaid order, or markPaid()'s
// best-effort recordOrderImpact() failed) — callers treat both the same:
// don't show the earned-impact block.
export async function getImpactForOrder(
  client: SupabaseClient<Database>,
  orderId: string
): Promise<{ pointsEarned: number; co2SavedKg: number } | null> {
  const { data, error } = await client
    .from("net_zero_ledger")
    .select("points_earned, co2_saved_kg")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw error;
  if (!data || (data.points_earned <= 0 && data.co2_saved_kg <= 0)) return null;
  return { pointsEarned: data.points_earned, co2SavedKg: data.co2_saved_kg };
}

// Batched variant of getImpactForOrder() for a whole order list
// (orders/page.tsx) — one query for every order on the page instead of one
// per card, same pattern as order.repository.ts's listStatusHistoryForOrders().
export async function getImpactForOrders(
  client: SupabaseClient<Database>,
  orderIds: string[]
): Promise<Map<string, { pointsEarned: number; co2SavedKg: number }>> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await client
    .from("net_zero_ledger")
    .select("order_id, points_earned, co2_saved_kg")
    .in("order_id", orderIds);
  if (error) throw error;

  const byOrder = new Map<string, { pointsEarned: number; co2SavedKg: number }>();
  for (const row of data) {
    if (row.points_earned <= 0 && row.co2_saved_kg <= 0) continue;
    byOrder.set(row.order_id, { pointsEarned: row.points_earned, co2SavedKg: row.co2_saved_kg });
  }
  return byOrder;
}

// Lazy expiry sweep — no cron/scheduled-job infrastructure exists in this
// app (same accepted gap as the best-before lock and group-order deadline),
// so this runs opportunistically at every point the balance is actually
// read or about to be redeemed (account/net-zero page, /cart, checkout),
// rather than on a schedule. Always the admin client — deducting from
// profiles.net_zero_points is the same money-adjacent write class as every
// other points mutation in this file (adjustBalance, recordOrderImpact).
//
// Known simplification, not a bug: this doesn't do true FIFO batch
// tracking of *which* specific earned points were later spent — it treats
// "points_earned from an order more than a year old" as expired regardless
// of whether the customer's current balance still technically includes
// some of that specific batch or spent it first. Exact batch-level
// accounting would need tracking remaining-quantity per ledger row (the
// same class of tradeoff already accepted for stock decrement in
// order.builder.ts) — not worth the complexity for this scope; the
// customer's balance can only ever end up equal to or lower than a fully
// exact FIFO calculation would give, never higher, so this can't let
// someone redeem points they shouldn't have.
export async function sweepExpiredPoints(
  adminClient: SupabaseClient<Database>,
  userId: string
): Promise<number> {
  const cutoff = new Date(Date.now() - EXPIRY_DAYS * 86_400_000).toISOString();
  const { data: expiredRows, error } = await adminClient
    .from("net_zero_ledger")
    .select("id, points_earned")
    .eq("user_id", userId)
    .is("swept_at", null)
    .lt("computed_at", cutoff)
    .gt("points_earned", 0);
  if (error) throw error;
  if (!expiredRows || expiredRows.length === 0) return 0;

  const totalExpired = expiredRows.reduce((sum, row) => sum + row.points_earned, 0);
  if (totalExpired > 0) {
    await adjustBalance(adminClient, userId, -totalExpired);
  }

  const { error: sweepError } = await adminClient
    .from("net_zero_ledger")
    .update({ swept_at: new Date().toISOString() })
    .in(
      "id",
      expiredRows.map((row) => row.id)
    );
  if (sweepError) throw sweepError;

  return totalExpired;
}

// Display-only — the soonest upcoming expiry date + how many points are in
// that batch, for account/net-zero/page.tsx's "sẽ hết hạn vào tháng X"
// line. Regular client is fine here (net_zero_ledger_select_own RLS, 0001,
// already scopes it to the caller's own rows) — same read-only posture as
// getSummary(). Callers should sweepExpiredPoints() first so an
// already-expired-but-not-yet-swept row never gets reported as "upcoming."
export async function getNextExpiry(
  client: SupabaseClient<Database>,
  userId: string
): Promise<NetZeroExpiry | null> {
  const { data, error } = await client
    .from("net_zero_ledger")
    .select("computed_at, points_earned")
    .eq("user_id", userId)
    .is("swept_at", null)
    .gt("points_earned", 0)
    .order("computed_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const expiresAt = new Date(new Date(data.computed_at).getTime() + EXPIRY_DAYS * 86_400_000);
  return { date: expiresAt.toISOString(), points: data.points_earned };
}
