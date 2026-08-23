import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { AdBooking, AdPlacementType } from "@/lib/domain/ad";
import { getOwnerIdById } from "@/lib/repositories/store.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";

// Every function below except listPlacementTypes()/listBookingsForStore()
// (both same-actor-safe reads scoped by existing RLS) uses the service-role
// admin client — ad_bookings handles money (amount_paid, payment_method,
// provider_txn_id) and its status transitions are only ever valid once a
// gateway's IPN confirms them, so this whole domain follows the exact
// `payments`/`store_subscriptions` pattern already established elsewhere
// in this app.

type PlacementRow = Database["public"]["Tables"]["ad_placement_types"]["Row"];

function mapPlacement(row: PlacementRow): AdPlacementType {
  return {
    id: row.id,
    key: row.key as AdPlacementType["key"],
    name: row.name,
    description: row.description,
    price: row.price,
    durationDays: row.duration_days,
    isActive: row.is_active,
  };
}

export async function listPlacementTypes(client: SupabaseClient<Database>): Promise<AdPlacementType[]> {
  const { data, error } = await client
    .from("ad_placement_types")
    .select("*")
    .eq("is_active", true)
    .order("price", { ascending: true });
  if (error) throw error;
  return data.map(mapPlacement);
}

export async function listAllPlacementTypesForAdmin(
  admin: SupabaseClient<Database>
): Promise<AdPlacementType[]> {
  const { data, error } = await admin.from("ad_placement_types").select("*").order("price", { ascending: true });
  if (error) throw error;
  return data.map(mapPlacement);
}

export interface CreatePlacementTypeInput {
  key: AdPlacementType["key"];
  name: string;
  description?: string;
  price: number;
  durationDays: number;
}

export async function createPlacementType(
  admin: SupabaseClient<Database>,
  input: CreatePlacementTypeInput
): Promise<void> {
  const { error } = await admin.from("ad_placement_types").insert({
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    price: input.price,
    duration_days: input.durationDays,
  });
  if (error) throw error;
}

export async function setPlacementTypeActive(
  admin: SupabaseClient<Database>,
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await admin.from("ad_placement_types").update({ is_active: isActive }).eq("id", id);
  if (error) throw error;
}

async function hydrateBookings(
  admin: SupabaseClient<Database>,
  rows: Database["public"]["Tables"]["ad_bookings"]["Row"][]
): Promise<AdBooking[]> {
  if (rows.length === 0) return [];

  const storeIds = [...new Set(rows.map((r) => r.store_id))];
  const placementIds = [...new Set(rows.map((r) => r.placement_type_id))];
  const comboIds = [...new Set(rows.map((r) => r.combo_id).filter((id): id is string => id !== null))];

  const [{ data: stores }, { data: placements }, { data: combos }] = await Promise.all([
    admin.from("stores").select("id, name").in("id", storeIds),
    admin.from("ad_placement_types").select("id, key, name").in("id", placementIds),
    comboIds.length > 0
      ? admin.from("combos").select("id, name").in("id", comboIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const storeNameById = new Map((stores ?? []).map((s) => [s.id, s.name]));
  const placementById = new Map((placements ?? []).map((p) => [p.id, p]));
  const comboNameById = new Map((combos ?? []).map((c) => [c.id, c.name]));

  return rows.map((row) => {
    const placement = placementById.get(row.placement_type_id);
    return {
      id: row.id,
      storeId: row.store_id,
      storeName: storeNameById.get(row.store_id) ?? "",
      placementTypeId: row.placement_type_id,
      placementKey: (placement?.key ?? "hot_deal") as AdBooking["placementKey"],
      placementName: placement?.name ?? "",
      comboId: row.combo_id,
      comboName: row.combo_id ? (comboNameById.get(row.combo_id) ?? null) : null,
      radiusM: row.radius_m,
      bannerImageUrl: row.banner_image_url,
      linkUrl: row.link_url,
      status: row.status,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      amountPaid: row.amount_paid,
      paymentMethod: row.payment_method,
      impressionCount: row.impression_count,
      clickCount: row.click_count,
      adminNote: row.admin_note,
      createdAt: row.created_at,
    };
  });
}

export async function listBookingsForStore(
  admin: SupabaseClient<Database>,
  storeId: string
): Promise<AdBooking[]> {
  const { data, error } = await admin
    .from("ad_bookings")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return hydrateBookings(admin, data);
}

export interface AdBookingAdminFilter {
  search?: string; // store name
  status?: AdBooking["status"];
}

export async function listBookingsForAdmin(
  admin: SupabaseClient<Database>,
  filter: AdBookingAdminFilter = {}
): Promise<AdBooking[]> {
  let query = admin.from("ad_bookings").select("*").order("created_at", { ascending: false });
  if (filter.status) query = query.eq("status", filter.status);
  const { data, error } = await query;
  if (error) throw error;

  let results = await hydrateBookings(admin, data);
  if (filter.search) {
    const needle = filter.search.toLowerCase();
    results = results.filter((r) => r.storeName.toLowerCase().includes(needle));
  }
  return results;
}

// Starts a purchase — inserts a 'pending_payment' row, returns what the
// checkout-initiation action needs to build a MoMo/VNPay redirect. Same
// "does NOT activate anything" posture as subscription.repository.ts's
// createPendingPurchase() — only markBookingPaid() (via the IPN webhooks)
// does that.
export async function createPendingBooking(
  admin: SupabaseClient<Database>,
  storeId: string,
  placementTypeId: string,
  input: { comboId?: string; radiusM?: number; bannerImageUrl?: string; linkUrl?: string }
): Promise<{ bookingId: string; amount: number; placementName: string }> {
  const { data: placement, error: placementError } = await admin
    .from("ad_placement_types")
    .select("id, key, name, price, is_active")
    .eq("id", placementTypeId)
    .single();
  if (placementError) throw placementError;
  if (!placement.is_active) throw new Error("Gói quảng cáo này hiện không còn được bán.");

  const needsCombo = ["hot_deal", "search_top", "category_top"].includes(placement.key);
  if (needsCombo && !input.comboId) {
    throw new Error("Vui lòng chọn combo muốn quảng cáo.");
  }
  if (placement.key === "homepage_banner" && !input.bannerImageUrl) {
    throw new Error("Vui lòng tải ảnh banner trước khi đặt mua.");
  }

  const { data: row, error } = await admin
    .from("ad_bookings")
    .insert({
      store_id: storeId,
      placement_type_id: placementTypeId,
      combo_id: needsCombo ? input.comboId : null,
      radius_m: input.radiusM ?? null,
      banner_image_url: input.bannerImageUrl ?? null,
      link_url: input.linkUrl ?? null,
      status: "pending_payment",
      amount_paid: placement.price,
    })
    .select("id")
    .single();
  if (error) throw error;

  return { bookingId: row.id, amount: placement.price, placementName: placement.name };
}

export async function getBookingById(
  admin: SupabaseClient<Database>,
  id: string
): Promise<{ id: string; status: string; amountPaid: number | null } | null> {
  const { data, error } = await admin.from("ad_bookings").select("id, status, amount_paid").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, status: data.status, amountPaid: data.amount_paid };
}

// Sibling of order.repository.ts's markPaid()/subscription.repository.ts's
// markSubscriptionPaid() — same idempotency guard (a real gateway's IPN can
// legitimately retry) and same "activate on confirmed payment only" rule.
export async function markBookingPaid(
  admin: SupabaseClient<Database>,
  bookingId: string,
  method: "vnpay" | "momo",
  providerTxnId?: string
): Promise<void> {
  const { data: row, error } = await admin
    .from("ad_bookings")
    .select("status, placement_type_id, store_id")
    .eq("id", bookingId)
    .single();
  if (error) throw error;
  if (row.status === "active") return;

  const { data: placement, error: placementError } = await admin
    .from("ad_placement_types")
    .select("duration_days, price, name")
    .eq("id", row.placement_type_id)
    .single();
  if (placementError) throw placementError;

  const now = new Date();
  const endsAt = new Date(now.getTime() + placement.duration_days * 86_400_000);

  const { error: updateError } = await admin
    .from("ad_bookings")
    .update({
      status: "active",
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      payment_method: method,
      provider_txn_id: providerTxnId ?? `SIMULATED-${Date.now()}`,
      amount_paid: placement.price,
    })
    .eq("id", bookingId);
  if (updateError) throw updateError;

  const ownerId = await getOwnerIdById(admin, row.store_id);
  if (ownerId) {
    await createNotification(admin, {
      userId: ownerId,
      type: "ad_activated",
      title: "Quảng cáo đã được kích hoạt",
      body: `Gói "${placement.name}" của cửa hàng bạn đang chạy tới ${endsAt.toLocaleDateString("vi-VN")}.`,
      payload: { bookingId },
    }).catch(() => {});
  }
}

// A real, honest fallback — not automation — for exactly two situations:
// (1) the actual "xét duyệt thủ công bởi quản trị viên" step diamond_partner's
// own description promises (an admin can require a manual look before
// granting the badge, not just clean up conflicts after the fact), and (2)
// a gateway IPN genuinely not arriving (caught live: a real VNPay sandbox
// test payment completed on VNPay's side but the webhook never confirmed
// it here) — the store already paid in that case, an admin needs a way to
// unblock them without waiting on a gateway mystery. `payment_method`/
// `provider_txn_id` are left null (no real gateway transaction backs this),
// distinct from a real markBookingPaid() call — `admin_note` records that
// it was a manual override, not silently indistinguishable from a real one.
export async function markBookingPaidManually(
  admin: SupabaseClient<Database>,
  bookingId: string,
  adminNote?: string
): Promise<void> {
  const { data: row, error } = await admin
    .from("ad_bookings")
    .select("status, placement_type_id, store_id")
    .eq("id", bookingId)
    .single();
  if (error) throw error;
  if (row.status === "active") return;

  const { data: placement, error: placementError } = await admin
    .from("ad_placement_types")
    .select("duration_days, name")
    .eq("id", row.placement_type_id)
    .single();
  if (placementError) throw placementError;

  const now = new Date();
  const endsAt = new Date(now.getTime() + placement.duration_days * 86_400_000);

  const { error: updateError } = await admin
    .from("ad_bookings")
    .update({
      status: "active",
      starts_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      admin_note: adminNote || "Admin xác nhận thanh toán thủ công",
    })
    .eq("id", bookingId);
  if (updateError) throw updateError;

  const ownerId = await getOwnerIdById(admin, row.store_id);
  if (ownerId) {
    await createNotification(admin, {
      userId: ownerId,
      type: "ad_activated",
      title: "Quảng cáo đã được kích hoạt",
      body: `Gói "${placement.name}" của cửa hàng bạn đang chạy tới ${endsAt.toLocaleDateString("vi-VN")}.`,
      payload: { bookingId },
    }).catch(() => {});
  }
}

// Store-facing cancel — the one self-service action a store gets on its own
// booking, and only while there's genuinely nothing to lose yet: no money
// has been confirmed collected (still 'pending_payment'). Cancelling an
// already-'active' (paid) booking is deliberately NOT exposed to the store
// itself — that's a refund-adjacent decision, same posture as this app's
// other explicitly-deferred refund handling (see CLAUDE.md's admin-module
// notes), left to admin discretion via cancelBooking() below instead.
// Ownership + status are both re-checked here, not just assumed from
// which store's dashboard the action was clicked from — this repository
// function could otherwise be called from any admin-client context.
export async function cancelOwnPendingBooking(
  admin: SupabaseClient<Database>,
  bookingId: string,
  storeId: string
): Promise<void> {
  const { data: row, error } = await admin
    .from("ad_bookings")
    .select("store_id, status")
    .eq("id", bookingId)
    .single();
  if (error) throw error;
  if (row.store_id !== storeId) throw new Error("Bạn không có quyền huỷ quảng cáo này.");
  if (row.status !== "pending_payment") {
    throw new Error("Chỉ có thể tự huỷ khi đang ở trạng thái chờ thanh toán.");
  }

  const { error: updateError } = await admin
    .from("ad_bookings")
    .update({ status: "cancelled" })
    .eq("id", bookingId);
  if (updateError) throw updateError;
}

// Admin-only judgment call, not automated enforcement — this app has no
// real geo-exclusivity engine, so "Đối tác Kim Cương độc quyền khu vực" is
// backed by an admin manually reviewing overlapping active bookings
// (listBookingsForAdmin filtered to diamond_partner) and cancelling one via
// this function, with a note explaining why. Also the general-purpose
// admin cancel for any booking regardless of status (pending or already
// active) — surfaced on every row in /admin/ads's full table, not just the
// diamond-conflict callout section.
export async function cancelBooking(
  admin: SupabaseClient<Database>,
  bookingId: string,
  adminNote?: string
): Promise<void> {
  const { error } = await admin
    .from("ad_bookings")
    .update({ status: "cancelled", admin_note: adminNote ?? null })
    .eq("id", bookingId);
  if (error) throw error;
}

// Fire-and-forget, read-then-write increments — same accepted "no row-
// locking Postgres function" tradeoff already documented for stock
// decrement (order.builder.ts) and Net Zero balance adjustments
// (net-zero.repository.ts): two simultaneous impressions could very rarely
// undercount by one. Fine at this app's traffic scale, and a lost
// impression/click isn't worth failing the page render over either way.
// Always the admin client — ad_bookings has zero client-facing UPDATE
// policy (payments pattern), even though these two are called from
// otherwise customer-facing code paths (a viewer seeing/clicking an ad).
// `combo_id` alone is enough to scope to the right bookings — only
// hot_deal/search_top/category_top bookings ever have one set
// (createPendingBooking's needsCombo check), homepage_banner/
// diamond_partner never do.
//
// Wired into combo-sections.tsx (the homepage's main entry point) only —
// not threaded into every list surface in this app (search results,
// individual carousels, the map panel) to keep this addition proportionate;
// the homepage is by far the highest-traffic surface a sponsored combo
// would actually show on.
export async function recordImpressionsForCombos(
  admin: SupabaseClient<Database>,
  comboIds: string[]
): Promise<void> {
  if (comboIds.length === 0) return;
  const now = new Date().toISOString();
  const { data } = await admin
    .from("ad_bookings")
    .select("id, impression_count")
    .in("combo_id", comboIds)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now);
  if (!data) return;
  await Promise.all(
    data.map((row) =>
      admin.from("ad_bookings").update({ impression_count: row.impression_count + 1 }).eq("id", row.id)
    )
  );
}

// Banner-specific variants (home-banner-carousel.tsx) — a banner has no
// combo_id to key off (createPendingBooking never sets one for
// homepage_banner), so these take the booking id directly instead.
export async function recordBannerImpression(admin: SupabaseClient<Database>, bookingId: string): Promise<void> {
  const { data } = await admin.from("ad_bookings").select("impression_count").eq("id", bookingId).maybeSingle();
  if (!data) return;
  await admin.from("ad_bookings").update({ impression_count: data.impression_count + 1 }).eq("id", bookingId);
}

export async function recordBannerClick(admin: SupabaseClient<Database>, bookingId: string): Promise<void> {
  const { data } = await admin.from("ad_bookings").select("click_count").eq("id", bookingId).maybeSingle();
  if (!data) return;
  await admin.from("ad_bookings").update({ click_count: data.click_count + 1 }).eq("id", bookingId);
}

// Called server-side from combos/[id]/page.tsx on every load of a
// currently-sponsored combo — simpler and more reliable than a client
// round trip, since that page already renders server-side.
export async function recordClickForCombo(admin: SupabaseClient<Database>, comboId: string): Promise<void> {
  const now = new Date().toISOString();
  const { data } = await admin
    .from("ad_bookings")
    .select("id, click_count")
    .eq("combo_id", comboId)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .limit(1)
    .maybeSingle();
  if (!data) return;
  await admin.from("ad_bookings").update({ click_count: data.click_count + 1 }).eq("id", data.id);
}

// Two-step, not an embedded select — same reasoning as every other cross-
// table read in this codebase's hand-maintained database.types.ts (empty
// Relationships arrays throughout, so `table!inner(...)` wouldn't type
// cleanly). Fetches every placement-type row for the given key (not just
// the seeded one) since an admin can add more variants of the same key
// later via /admin/ads.
async function placementIdsForKey(admin: SupabaseClient<Database>, key: string): Promise<string[]> {
  const { data, error } = await admin.from("ad_placement_types").select("id").eq("key", key);
  if (error) throw error;
  return data.map((p) => p.id);
}

// Public-facing (homepage): active banner bookings, newest first. Regular
// client can't be used — ad_bookings has no public select policy, so this
// specifically needs the admin client despite being a public-facing read
// (same posture as combo activation's notification fan-out).
export async function listActiveBanners(admin: SupabaseClient<Database>): Promise<AdBooking[]> {
  const placementIds = await placementIdsForKey(admin, "homepage_banner");
  if (placementIds.length === 0) return [];

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ad_bookings")
    .select("*")
    .in("placement_type_id", placementIds)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return hydrateBookings(admin, data);
}

// Store-level badge (combos/[id]/page.tsx, store-detail-panel.tsx) — does
// this store currently have an active diamond_partner booking. Same
// "cheap, read-only check" posture as getEffectiveSubscription()'s tier
// check for the Premium badge.
export async function hasActiveDiamondPartner(
  admin: SupabaseClient<Database>,
  storeId: string
): Promise<boolean> {
  const placementIds = await placementIdsForKey(admin, "diamond_partner");
  if (placementIds.length === 0) return false;

  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("ad_bookings")
    .select("id")
    .eq("store_id", storeId)
    .in("placement_type_id", placementIds)
    .eq("status", "active")
    .lte("starts_at", now)
    .gt("ends_at", now)
    .limit(1);
  if (error) throw error;
  return data.length > 0;
}
