import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  Combo,
  ComboSnapshot,
  ComboStatus,
  NearbyCombo,
  StoreComboSummary,
} from "@/lib/domain/combo";
import type { BuiltCombo } from "@/lib/factories/combo.builder";
import { resolvePricingStrategy } from "@/lib/pricing/strategies/pricing-strategy.factory";
import { computeStockBasedDecayPrice } from "@/lib/pricing/strategies/stock-based-decay.strategy";

type ComboRow = Database["public"]["Tables"]["combos"]["Row"];

// Paginated, store-scoped listing for the map's store detail panel
// (store-detail-panel.tsx) — "kéo tới đâu hiển thị tới đó" (load-as-you-
// scroll, not the whole store's catalog at once). Two queries rather than
// an embedded combo_images select: this file's own hydrate() already
// established that pattern (separate items/images queries) for
// combos/combo_images, and database.types.ts here is hand-maintained with
// empty Relationships arrays, so a typed embedded select wouldn't type-
// check cleanly anyway. Same best_before > now() rule as
// 0011_best_before_listing_filter.sql — an expired combo shouldn't show
// here either, even from the store's own detail panel.
export async function listActiveByStorePaginated(
  client: SupabaseClient<Database>,
  storeId: string,
  { limit = 10, offset = 0 }: { limit?: number; offset?: number } = {}
): Promise<{ combos: StoreComboSummary[]; hasMore: boolean }> {
  const { data: rows, error, count } = await client
    .from("combos")
    .select(
      "id, name, current_price, original_price, best_before, initial_stock, remaining_stock, created_at",
      { count: "exact" }
    )
    .eq("store_id", storeId)
    .eq("status", "active")
    .gt("best_before", new Date().toISOString())
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  if (rows.length === 0) return { combos: [], hasMore: false };

  const ids = rows.map((r) => r.id);
  const { data: images, error: imagesError } = await client
    .from("combo_images")
    .select("combo_id, url, sort_order")
    .in("combo_id", ids)
    .order("sort_order");
  if (imagesError) throw imagesError;

  const firstImageByCombo = new Map<string, string>();
  for (const img of images) {
    if (!firstImageByCombo.has(img.combo_id)) firstImageByCombo.set(img.combo_id, img.url);
  }

  return {
    combos: rows.map((r) => ({
      comboId: r.id,
      name: r.name,
      // See lib/pricing/strategies/stock-based-decay.strategy.ts — every
      // combo runs pricing_strategy = 'stock_based_decay' in practice, so
      // this reads straight from the shared formula rather than round-
      // tripping through resolvePricingStrategy() for a plain (non-Combo)
      // row shape.
      currentPrice: computeStockBasedDecayPrice({
        originalPrice: r.original_price,
        initialStock: r.initial_stock,
        remainingStock: r.remaining_stock,
        createdAt: r.created_at,
        bestBefore: r.best_before,
      }),
      originalPrice: r.original_price,
      bestBefore: r.best_before,
      imageUrl: firstImageByCombo.get(r.id) ?? null,
    })),
    hasMore: count !== null && offset + limit < count,
  };
}

// Backed by the nearby_combos() SQL function, which orders via the PostGIS
// GiST index's KNN operator (`<->`) and filters via ST_DWithin — never a
// full table scan. See supabase/migrations/0001_init_schema.sql.
export async function listNearby(
  client: SupabaseClient<Database>,
  lat: number,
  lng: number,
  radiusM = 5000,
  maxResults = 20,
  categoryId?: string
): Promise<NearbyCombo[]> {
  const { data, error } = await client.rpc("nearby_combos", {
    in_lat: lat,
    in_lng: lng,
    radius_m: radiusM,
    max_results: maxResults,
    in_category_id: categoryId ?? null,
  });
  if (error) throw error;

  return data.map((row) => ({
    comboId: row.combo_id,
    name: row.name,
    currentPrice: row.current_price,
    originalPrice: row.original_price,
    bestBefore: row.best_before,
    storeId: row.store_id,
    storeName: row.store_name,
    distanceM: row.distance_m,
    imageUrl: row.image_url,
    deliverySupported: row.delivery_supported,
    pickupSupported: row.pickup_supported,
  }));
}

export interface SearchComboOptions {
  query?: string;
  radiusM?: number;
  maxResults?: number;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: "relevance" | "price_asc" | "price_desc" | "newest";
}

// Backed by search_combos() (0008_search_combos.sql) — a separate RPC from
// nearby_combos() on purpose, see that migration's header comment: sorting
// by price/relevance instead of pure KNN distance needs a different ORDER
// BY shape than what keeps nearby_combos' index-assisted ordering working.
// Text search still goes through the same trgm-indexed expression as the
// rest of the app (idx_combos_name_trgm / idx_stores_name_trgm).
export async function search(
  client: SupabaseClient<Database>,
  lat: number,
  lng: number,
  options: SearchComboOptions = {}
): Promise<NearbyCombo[]> {
  const { data, error } = await client.rpc("search_combos", {
    in_lat: lat,
    in_lng: lng,
    in_query: options.query ?? null,
    radius_m: options.radiusM ?? 5000,
    max_results: options.maxResults ?? 30,
    in_category_id: options.categoryId ?? null,
    min_price: options.minPrice ?? null,
    max_price: options.maxPrice ?? null,
    sort_by: options.sortBy ?? "relevance",
  });
  if (error) throw error;

  return data.map((row) => ({
    comboId: row.combo_id,
    name: row.name,
    currentPrice: row.current_price,
    originalPrice: row.original_price,
    bestBefore: row.best_before,
    storeId: row.store_id,
    storeName: row.store_name,
    distanceM: row.distance_m,
    imageUrl: row.image_url,
    deliverySupported: row.delivery_supported,
    pickupSupported: row.pickup_supported,
  }));
}

// Used at checkout to re-validate cart items against live data — see
// order.builder.ts. Deliberately skips the items/images joins hydrate() does
// since order validation only needs price/stock/status.
export async function getSnapshotsByIds(
  client: SupabaseClient<Database>,
  ids: string[]
): Promise<ComboSnapshot[]> {
  if (ids.length === 0) return [];

  const { data, error } = await client
    .from("combos")
    .select(
      "id, store_id, name, current_price, original_price, status, best_before, remaining_stock, initial_stock, created_at, delivery_supported, pickup_supported"
    )
    .in("id", ids);
  if (error) throw error;

  // This is the checkout-charging path (order.builder.ts re-validates every
  // cart line against a fresh snapshot) — recomputing the dynamic price here,
  // at submit time, is exactly what makes it impossible to "wait out the
  // clock" for a price seen earlier in the browsing session. See
  // stock-based-decay.strategy.ts for why this calls the shared formula
  // directly rather than going through resolvePricingStrategy().
  return data.map((row) => ({
    id: row.id,
    storeId: row.store_id,
    name: row.name,
    currentPrice: computeStockBasedDecayPrice({
      originalPrice: row.original_price,
      initialStock: row.initial_stock,
      remainingStock: row.remaining_stock,
      createdAt: row.created_at,
      bestBefore: row.best_before,
    }),
    status: row.status,
    bestBefore: row.best_before,
    remainingStock: row.remaining_stock,
    deliverySupported: row.delivery_supported,
    pickupSupported: row.pickup_supported,
  }));
}

interface StoreRef {
  name: string;
  addressLine: string;
  ownerId: string;
}

export async function listByStore(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<Combo[]> {
  const { data: comboRows, error } = await client
    .from("combos")
    .select("*")
    .eq("store_id", storeId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (comboRows.length === 0) return [];

  const { data: store, error: storeError } = await client
    .from("stores")
    .select("name, address_line, owner_id")
    .eq("id", storeId)
    .single();
  if (storeError) throw storeError;

  const storeRef: StoreRef = { name: store.name, addressLine: store.address_line, ownerId: store.owner_id };
  return Promise.all(comboRows.map((row) => hydrate(client, row, storeRef)));
}

export async function getById(
  client: SupabaseClient<Database>,
  id: string
): Promise<Combo | null> {
  const { data: row, error } = await client.from("combos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: store, error: storeError } = await client
    .from("stores")
    .select("name, address_line, owner_id")
    .eq("id", row.store_id)
    .single();
  if (storeError) throw storeError;

  return hydrate(client, row, {
    name: store.name,
    addressLine: store.address_line,
    ownerId: store.owner_id,
  });
}

async function hydrate(
  client: SupabaseClient<Database>,
  row: ComboRow,
  store: StoreRef
): Promise<Combo> {
  const [{ data: items, error: itemsError }, { data: images, error: imagesError }] =
    await Promise.all([
      client
        .from("combo_items")
        .select("*")
        .eq("combo_id", row.id),
      client
        .from("combo_images")
        .select("*")
        .eq("combo_id", row.id)
        .order("sort_order"),
    ]);
  if (itemsError) throw itemsError;
  if (imagesError) throw imagesError;

  const combo: Combo = {
    id: row.id,
    storeId: row.store_id,
    storeOwnerId: store.ownerId,
    storeName: store.name,
    storeAddressLine: store.addressLine,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    originalPrice: row.original_price,
    // Placeholder — FixedPriceStrategy would just echo this stored column
    // straight back, StockBasedDecayStrategy (the live default) ignores it
    // and recomputes fresh below. See pricing-strategy.factory.ts.
    currentPrice: row.current_price,
    initialStock: row.initial_stock,
    remainingStock: row.remaining_stock,
    bestBefore: row.best_before,
    createdAt: row.created_at,
    deliverySupported: row.delivery_supported,
    pickupSupported: row.pickup_supported,
    status: row.status,
    items: items.map((i) => ({
      id: i.id,
      itemName: i.item_name,
      itemDescription: i.item_description,
      quantity: i.quantity,
    })),
    images: images.map((i) => i.url),
  };
  // This is the one repository path that builds a full domain Combo, so
  // it's also the one path that goes through the real polymorphic
  // resolvePricingStrategy() dispatch documented in
  // .claude/rules/stack-and-conventions.md, rather than calling the shared
  // decay formula directly (see the lighter read shapes elsewhere in this
  // file, which skip the dispatch since every combo is 'stock_based_decay'
  // in practice).
  combo.currentPrice = resolvePricingStrategy(row.pricing_strategy).calculatePrice(
    combo,
    new Date()
  );
  return combo;
}

// Combo creation is a multi-table write (combo + items + images) built by
// ComboBuilder. The combo row starts life as 'draft' and only flips to
// 'active' once items have been inserted successfully — bounding the blast
// radius of a partial failure to a harmless draft with no items, rather than
// a "live" combo with missing contents. A true multi-statement transaction
// would need a Postgres function; not worth it for a solo phase-1 scope.
//
// `store` is passed in rather than re-queried here — callers
// (dashboard/combos/actions.ts) already have the Store from resolving the
// current user's store, so re-fetching it after every write was a wasted
// round trip. Items and images inserts are independent of each other and
// run in parallel for the same reason (see combo-detail perf investigation
// — Supabase's per-request latency adds up fast when calls that don't
// depend on each other are still awaited sequentially).
export async function create(
  client: SupabaseClient<Database>,
  built: BuiltCombo,
  store: StoreRef
): Promise<Combo> {
  const { data: combo, error } = await client
    .from("combos")
    .insert({ ...built.combo, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;

  const [itemsResult, imagesResult] = await Promise.all([
    built.items.length > 0
      ? client.from("combo_items").insert(built.items.map((item) => ({ ...item, combo_id: combo.id })))
      : Promise.resolve({ error: null }),
    built.imageUrls.length > 0
      ? client
          .from("combo_images")
          .insert(built.imageUrls.map((url, index) => ({ combo_id: combo.id, url, sort_order: index })))
      : Promise.resolve({ error: null }),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (imagesResult.error) throw imagesResult.error;

  const { data: activated, error: activateError } = await client
    .from("combos")
    .update({ status: "active" })
    .eq("id", combo.id)
    .select("*")
    .single();
  if (activateError) throw activateError;

  return hydrate(client, activated, store);
}

export async function update(
  client: SupabaseClient<Database>,
  id: string,
  built: BuiltCombo,
  store: StoreRef
): Promise<Combo> {
  const { data: combo, error } = await client
    .from("combos")
    .update(built.combo)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  // The items delete+insert and images delete+insert are two independent
  // chains (neither touches the other's table) — run them concurrently
  // instead of as four sequential round trips.
  const [itemsResult, imagesResult] = await Promise.all([
    (async () => {
      const { error: deleteError } = await client.from("combo_items").delete().eq("combo_id", id);
      if (deleteError) return { error: deleteError };
      if (built.items.length === 0) return { error: null };
      return client.from("combo_items").insert(built.items.map((item) => ({ ...item, combo_id: id })));
    })(),
    (async () => {
      const { error: deleteError } = await client.from("combo_images").delete().eq("combo_id", id);
      if (deleteError) return { error: deleteError };
      if (built.imageUrls.length === 0) return { error: null };
      return client
        .from("combo_images")
        .insert(built.imageUrls.map((url, index) => ({ combo_id: id, url, sort_order: index })));
    })(),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (imagesResult.error) throw imagesResult.error;

  return hydrate(client, combo, store);
}

export async function updateStatus(
  client: SupabaseClient<Database>,
  id: string,
  status: ComboStatus
): Promise<void> {
  const { error } = await client.from("combos").update({ status }).eq("id", id);
  if (error) throw error;
}
