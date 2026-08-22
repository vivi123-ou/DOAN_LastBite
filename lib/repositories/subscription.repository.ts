import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  SubscriptionPlan,
  EffectiveSubscription,
  StoreSubscription,
  AdminStoreSubscriptionSummary,
  SubscriptionStatus,
} from "@/lib/domain/subscription";
import { getOwnerIdById } from "@/lib/repositories/store.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";
import { ADMIN_PAGE_SIZE, type PaginatedResult } from "@/lib/domain/pagination";

// Every function below except listPlans() uses the service-role admin
// client — store_subscriptions handles money (amount_paid, payment_method,
// provider_txn_id) and its status transitions are only ever valid once a
// gateway's IPN confirms them, so this whole domain follows the `payments`
// pattern (.claude/rules/database-and-schema.md): no client policy allows
// the state transition, only server code with the service-role key.
// listPlans() is the one genuinely public, same-actor-safe read (any
// signed-in store owner browsing what's for sale).

type PlanRow = {
  id: string;
  name: string;
  price: number;
  duration_days: number;
  max_active_combos: number | null;
  description: string | null;
  is_default: boolean;
  is_active: boolean;
};

function mapPlan(row: PlanRow): SubscriptionPlan {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    durationDays: row.duration_days,
    maxActiveCombos: row.max_active_combos,
    description: row.description,
    isDefault: row.is_default,
    isActive: row.is_active,
  };
}

export async function listPlans(client: SupabaseClient<Database>): Promise<SubscriptionPlan[]> {
  const { data, error } = await client
    .from("subscription_plans")
    .select("id, name, price, duration_days, max_active_combos, description, is_default, is_active")
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (error) throw error;
  return data.map(mapPlan);
}

export async function listAllPlansForAdmin(
  admin: SupabaseClient<Database>
): Promise<SubscriptionPlan[]> {
  const { data, error } = await admin
    .from("subscription_plans")
    .select("id, name, price, duration_days, max_active_combos, description, is_default, is_active")
    .order("price", { ascending: true });
  if (error) throw error;
  return data.map(mapPlan);
}

export interface CreatePlanInput {
  name: string;
  price: number;
  durationDays: number;
  maxActiveCombos: number | null;
  description?: string;
}

export async function createPlan(admin: SupabaseClient<Database>, input: CreatePlanInput): Promise<void> {
  const { error } = await admin.from("subscription_plans").insert({
    name: input.name,
    price: input.price,
    duration_days: input.durationDays,
    max_active_combos: input.maxActiveCombos,
    description: input.description ?? null,
  });
  if (error) throw error;
}

export async function setPlanActive(
  admin: SupabaseClient<Database>,
  planId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await admin.from("subscription_plans").update({ is_active: isActive }).eq("id", planId);
  if (error) throw error;
}

// The plan/limit a store is *actually* subject to right now — resolved
// live from its most recent status='active' row and that row's expires_at,
// never from a stored/swept status flag. Same lazy-recompute philosophy as
// best_before locking and Net Zero point expiry elsewhere in this app — no
// cron flips anything, "expired" is just what today's read computes.
export async function getEffectiveSubscription(
  admin: SupabaseClient<Database>,
  storeId: string
): Promise<EffectiveSubscription> {
  const { data: defaultPlan, error: defaultError } = await admin
    .from("subscription_plans")
    .select("name, max_active_combos")
    .eq("is_default", true)
    .limit(1)
    .maybeSingle();
  if (defaultError) throw defaultError;

  const { data: activeRow, error: activeError } = await admin
    .from("store_subscriptions")
    .select("plan_id, expires_at")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (activeError) throw activeError;

  // Never bought anything (or the only rows are pending/cancelled) — a
  // brand-new store, or one that let a purchase attempt lapse without
  // paying. Falls back to the seeded default plan, never locked.
  if (!activeRow) {
    return {
      planName: defaultPlan?.name ?? "Free",
      maxActiveCombos: defaultPlan?.max_active_combos ?? null,
      locked: false,
      expiresAt: null,
      daysUntilExpiry: null,
    };
  }

  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("name, max_active_combos")
    .eq("id", activeRow.plan_id)
    .single();
  if (planError) throw planError;

  const expiresAt = activeRow.expires_at ? new Date(activeRow.expires_at) : null;
  // Per the explicit business rule ("tự động khóa... nếu cửa hàng hết hạn
  // gói Basic/Premium") — an expired paid plan fully blocks new combos,
  // it does NOT quietly fall back to Free's limits.
  const locked = Boolean(expiresAt && expiresAt.getTime() <= Date.now());
  const daysUntilExpiry = expiresAt
    ? Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000)
    : null;

  return {
    planName: plan.name,
    maxActiveCombos: plan.max_active_combos,
    locked,
    expiresAt: activeRow.expires_at,
    daysUntilExpiry,
  };
}

// Store-facing "my subscription" read — used by the store's own
// /dashboard/subscription page. Admin client throughout this file (see the
// top-of-file comment), including this same-actor read, so it isn't
// affected by subscription_plans_select_active's RLS if the plan a store
// already bought has since been deactivated by an admin.
export async function getCurrentSubscriptionForStore(
  admin: SupabaseClient<Database>,
  storeId: string
): Promise<StoreSubscription | null> {
  const { data: row, error } = await admin
    .from("store_subscriptions")
    .select("id, store_id, plan_id, status, started_at, expires_at, amount_paid")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("name")
    .eq("id", row.plan_id)
    .maybeSingle();
  if (planError) throw planError;

  return {
    id: row.id,
    storeId: row.store_id,
    planId: row.plan_id,
    planName: plan?.name ?? "",
    status: row.status,
    startedAt: row.started_at,
    expiresAt: row.expires_at,
    amountPaid: row.amount_paid,
  };
}

// Starts a purchase — inserts a 'pending_payment' row, returns what the
// checkout-initiation action (dashboard/subscription/actions.ts) needs to
// build a MoMo/VNPay redirect. Does NOT activate anything; only the
// subscription IPN webhooks (markSubscriptionPaid below) do that, same
// "never trust the redirect alone" posture as order payments.
export async function createPendingPurchase(
  admin: SupabaseClient<Database>,
  storeId: string,
  planId: string
): Promise<{ subscriptionId: string; amount: number; planName: string }> {
  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("id, name, price, is_active")
    .eq("id", planId)
    .single();
  if (planError) throw planError;
  if (!plan.is_active) throw new Error("Gói dịch vụ này hiện không còn được bán.");

  const { data: row, error } = await admin
    .from("store_subscriptions")
    .insert({ store_id: storeId, plan_id: planId, status: "pending_payment", amount_paid: plan.price })
    .select("id")
    .single();
  if (error) throw error;

  return { subscriptionId: row.id, amount: plan.price, planName: plan.name };
}

// Minimal read for the VNPay subscription IPN route (which needs to check
// amount/current status before deciding a RspCode — see that route's own
// comment for why it can't just call markSubscriptionPaid() unconditionally).
export async function getSubscriptionById(
  admin: SupabaseClient<Database>,
  id: string
): Promise<{ id: string; status: string; amountPaid: number | null } | null> {
  const { data, error } = await admin
    .from("store_subscriptions")
    .select("id, status, amount_paid")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, status: data.status, amountPaid: data.amount_paid };
}

// Called from the subscription-specific MoMo/VNPay IPN webhooks
// (app/api/payments/{momo,vnpay}/subscription-ipn/route.ts) — a deliberate
// sibling pair to order.repository.ts's markPaid(), not a shared generic
// function, since "what happens after payment" genuinely differs (activate
// a subscription window vs. mark an order paid + generate a QR). Same
// idempotency guard reasoning: a real gateway's IPN can legitimately retry.
export async function markSubscriptionPaid(
  admin: SupabaseClient<Database>,
  subscriptionId: string,
  method: "vnpay" | "momo",
  providerTxnId?: string
): Promise<void> {
  const { data: row, error } = await admin
    .from("store_subscriptions")
    .select("status, plan_id, store_id")
    .eq("id", subscriptionId)
    .single();
  if (error) throw error;
  if (row.status === "active") return;

  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("duration_days, price")
    .eq("id", row.plan_id)
    .single();
  if (planError) throw planError;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + plan.duration_days * 86_400_000);

  const { error: updateError } = await admin
    .from("store_subscriptions")
    .update({
      status: "active",
      started_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_method: method,
      provider_txn_id: providerTxnId ?? `SIMULATED-${Date.now()}`,
      amount_paid: plan.price,
    })
    .eq("id", subscriptionId);
  if (updateError) throw updateError;

  // Keep the legacy stores.tier ('free'/'premium', dormant since phase 1)
  // in sync — see 0027's own migration comment for why this is worth doing
  // rather than leaving it stale next to a brand-new parallel concept.
  // Best-effort: this cosmetic sync shouldn't fail a genuinely successful
  // payment confirmation.
  await admin.from("stores").update({ tier: "premium" }).eq("id", row.store_id).then(
    () => {},
    () => {}
  );

  const ownerId = await getOwnerIdById(admin, row.store_id);
  if (ownerId) {
    await createNotification(admin, {
      userId: ownerId,
      type: "subscription_activated",
      title: "Gói dịch vụ đã được kích hoạt",
      body: `Gói dịch vụ của cửa hàng bạn đã được gia hạn tới ${expiresAt.toLocaleDateString("vi-VN")}.`,
      payload: { subscriptionId },
    }).catch(() => {});
  }
}

const RENEWAL_WARNING_DAYS = 7;

// Lazy sweep — no cron infrastructure exists in this app (same accepted gap
// as best-before locking, group-order finalization, Net Zero point
// expiry), so this runs opportunistically whenever the store's own
// /dashboard/subscription page loads, not on a schedule.
// renewal_notified_at guards against re-notifying on every page load once
// the warning has already fired once for this particular subscription row.
export async function checkAndNotifyExpiringSoon(
  admin: SupabaseClient<Database>,
  storeId: string
): Promise<void> {
  const { data: activeRow, error } = await admin
    .from("store_subscriptions")
    .select("id, expires_at, renewal_notified_at")
    .eq("store_id", storeId)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!activeRow || !activeRow.expires_at || activeRow.renewal_notified_at) return;

  const expiresAt = new Date(activeRow.expires_at);
  const daysLeft = (expiresAt.getTime() - Date.now()) / 86_400_000;
  if (daysLeft > RENEWAL_WARNING_DAYS || daysLeft < 0) return;

  const ownerId = await getOwnerIdById(admin, storeId);
  if (ownerId) {
    await createNotification(admin, {
      userId: ownerId,
      type: "subscription_expiring_soon",
      title: "Gói dịch vụ sắp hết hạn",
      body: `Gói dịch vụ của cửa hàng bạn sẽ hết hạn vào ${expiresAt.toLocaleDateString("vi-VN")} — gia hạn ngay để không bị khoá tính năng đăng combo mới.`,
      payload: { storeId },
    }).catch(() => {});
  }

  await admin
    .from("store_subscriptions")
    .update({ renewal_notified_at: new Date().toISOString() })
    .eq("id", activeRow.id);
}

export interface AdminSubscriptionListFilter {
  search?: string; // store name
  status?: SubscriptionStatus;
  page?: number; // 1-based
}

// Admin's /admin/subscriptions list — latest row per store, JS-grouped
// (small aggregation over a narrow query, same preference already
// established for order.repository.ts's getTopPurchasedCategoryIds() and
// friend.repository.ts's listFriendships()) rather than a dedicated RPC.
// `search`/`status` are both applied *after* the "latest row per store"
// reduction, in JS — `status` specifically can't be pushed into the initial
// query the way listPayoutsForAdmin's can, since this list means "stores
// whose *current* (latest) status is X," not "stores that ever had any row
// with status X" — filtering the raw rows first would change that meaning.
// `search` needs the join (store names) resolved first regardless.
export async function listStoreSubscriptionsForAdmin(
  admin: SupabaseClient<Database>,
  filter: AdminSubscriptionListFilter = {}
): Promise<PaginatedResult<AdminStoreSubscriptionSummary>> {
  const { data: rows, error } = await admin
    .from("store_subscriptions")
    .select("store_id, plan_id, status, started_at, expires_at, amount_paid, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (rows.length === 0) return { items: [], totalCount: 0 };

  const latestByStore = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!latestByStore.has(r.store_id)) latestByStore.set(r.store_id, r);
  }
  let latestRows = [...latestByStore.values()];
  if (filter.status) latestRows = latestRows.filter((r) => r.status === filter.status);

  const storeIds = latestRows.map((r) => r.store_id);
  const planIds = [...new Set(latestRows.map((r) => r.plan_id))];

  const [{ data: stores, error: storesError }, { data: plans, error: plansError }] = await Promise.all([
    admin.from("stores").select("id, name").in("id", storeIds),
    admin.from("subscription_plans").select("id, name").in("id", planIds),
  ]);
  if (storesError) throw storesError;
  if (plansError) throw plansError;
  const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
  const planNameById = new Map(plans.map((p) => [p.id, p.name]));

  let results = latestRows.map((r) => ({
    storeId: r.store_id,
    storeName: storeNameById.get(r.store_id) ?? "",
    planName: planNameById.get(r.plan_id) ?? "",
    status: r.status,
    startedAt: r.started_at,
    expiresAt: r.expires_at,
    amountPaid: r.amount_paid,
  }));

  if (filter.search) {
    const needle = filter.search.toLowerCase();
    results = results.filter((r) => r.storeName.toLowerCase().includes(needle));
  }

  const totalCount = results.length;
  const page = filter.page ?? 1;
  const start = (page - 1) * ADMIN_PAGE_SIZE;
  return { items: results.slice(start, start + ADMIN_PAGE_SIZE), totalCount };
}
