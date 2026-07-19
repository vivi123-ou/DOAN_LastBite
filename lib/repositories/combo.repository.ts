import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Combo, ComboStatus, NearbyCombo } from "@/lib/domain/combo";
import type { BuiltCombo } from "@/lib/factories/combo.builder";

type ComboRow = Database["public"]["Tables"]["combos"]["Row"];

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
  }));
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
    .select("name, address_line")
    .eq("id", storeId)
    .single();
  if (storeError) throw storeError;

  return Promise.all(comboRows.map((row) => hydrate(client, row, store.name, store.address_line)));
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
    .select("name, address_line")
    .eq("id", row.store_id)
    .single();
  if (storeError) throw storeError;

  return hydrate(client, row, store.name, store.address_line);
}

async function hydrate(
  client: SupabaseClient<Database>,
  row: ComboRow,
  storeName: string,
  storeAddressLine: string
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

  return {
    id: row.id,
    storeId: row.store_id,
    storeName,
    storeAddressLine,
    categoryId: row.category_id,
    name: row.name,
    description: row.description,
    originalPrice: row.original_price,
    currentPrice: row.current_price,
    initialStock: row.initial_stock,
    remainingStock: row.remaining_stock,
    bestBefore: row.best_before,
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
}

// Combo creation is a multi-table write (combo + items + images) built by
// ComboBuilder. The combo row starts life as 'draft' and only flips to
// 'active' once items have been inserted successfully — bounding the blast
// radius of a partial failure to a harmless draft with no items, rather than
// a "live" combo with missing contents. A true multi-statement transaction
// would need a Postgres function; not worth it for a solo phase-1 scope.
export async function create(
  client: SupabaseClient<Database>,
  built: BuiltCombo
): Promise<Combo> {
  const { data: combo, error } = await client
    .from("combos")
    .insert({ ...built.combo, status: "draft" })
    .select("*")
    .single();
  if (error) throw error;

  if (built.items.length > 0) {
    const { error: itemsError } = await client
      .from("combo_items")
      .insert(built.items.map((item) => ({ ...item, combo_id: combo.id })));
    if (itemsError) throw itemsError;
  }

  if (built.imageUrls.length > 0) {
    const { error: imagesError } = await client.from("combo_images").insert(
      built.imageUrls.map((url, index) => ({ combo_id: combo.id, url, sort_order: index }))
    );
    if (imagesError) throw imagesError;
  }

  const { data: activated, error: activateError } = await client
    .from("combos")
    .update({ status: "active" })
    .eq("id", combo.id)
    .select("*")
    .single();
  if (activateError) throw activateError;

  const { data: store } = await client
    .from("stores")
    .select("name, address_line")
    .eq("id", activated.store_id)
    .single();

  return hydrate(client, activated, store?.name ?? "", store?.address_line ?? "");
}

export async function update(
  client: SupabaseClient<Database>,
  id: string,
  built: BuiltCombo
): Promise<Combo> {
  const { data: combo, error } = await client
    .from("combos")
    .update(built.combo)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;

  const { error: deleteItemsError } = await client
    .from("combo_items")
    .delete()
    .eq("combo_id", id);
  if (deleteItemsError) throw deleteItemsError;

  if (built.items.length > 0) {
    const { error: itemsError } = await client
      .from("combo_items")
      .insert(built.items.map((item) => ({ ...item, combo_id: id })));
    if (itemsError) throw itemsError;
  }

  const { error: deleteImagesError } = await client
    .from("combo_images")
    .delete()
    .eq("combo_id", id);
  if (deleteImagesError) throw deleteImagesError;

  if (built.imageUrls.length > 0) {
    const { error: imagesError } = await client.from("combo_images").insert(
      built.imageUrls.map((url, index) => ({ combo_id: id, url, sort_order: index }))
    );
    if (imagesError) throw imagesError;
  }

  const { data: store } = await client
    .from("stores")
    .select("name, address_line")
    .eq("id", combo.store_id)
    .single();

  return hydrate(client, combo, store?.name ?? "", store?.address_line ?? "");
}

export async function updateStatus(
  client: SupabaseClient<Database>,
  id: string,
  status: ComboStatus
): Promise<void> {
  const { error } = await client.from("combos").update({ status }).eq("id", id);
  if (error) throw error;
}
