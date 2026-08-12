import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { NetZeroSummary } from "@/lib/domain/net-zero";
import { calculatePointsEarned } from "@/lib/pricing/net-zero/net-zero.policy";

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

  const { error: ledgerError } = await adminClient.from("net_zero_ledger").insert({
    user_id: customerId,
    order_id: orderId,
    co2_saved_kg: co2SavedKg,
  });
  if (ledgerError) throw ledgerError;

  const pointsEarned = calculatePointsEarned(totalAmount);
  if (pointsEarned > 0) {
    await adjustBalance(adminClient, customerId, pointsEarned);
  }

  return { pointsEarned, co2SavedKg };
}
