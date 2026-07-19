import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { RegisterStoreInput, Store } from "@/lib/domain/store";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];

function toDomain(row: StoreRow): Store {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    description: row.description,
    addressLine: row.address_line,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    verificationStatus: row.verification_status,
    tier: row.tier,
    logoUrl: row.logo_url,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getLocationsByIds(
  client: SupabaseClient<Database>,
  storeIds: string[]
): Promise<Record<string, { lat: number; lng: number }>> {
  if (storeIds.length === 0) return {};

  const { data, error } = await client.from("stores").select("id, lat, lng").in("id", storeIds);
  if (error) throw error;

  const locations: Record<string, { lat: number; lng: number }> = {};
  for (const row of data) {
    if (row.lat != null && row.lng != null) {
      locations[row.id] = { lat: row.lat, lng: row.lng };
    }
  }
  return locations;
}

export async function getStoreByOwnerId(
  client: SupabaseClient<Database>,
  ownerId: string
): Promise<Store | null> {
  const { data, error } = await client
    .from("stores")
    .select("*")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw error;
  return data ? toDomain(data) : null;
}

// Registers a store for the signed-in user and promotes them to store_owner.
// A user becomes a store_owner by registering a store, not through a
// separate role picker (see 0001_init_schema.sql handle_new_user() comment)
// — this keeps the Google OAuth signup path (which carries no role metadata)
// and the email/password path consistent.
export async function registerStore(
  client: SupabaseClient<Database>,
  ownerId: string,
  input: RegisterStoreInput
): Promise<Store> {
  const { data, error } = await client
    .from("stores")
    .insert({
      owner_id: ownerId,
      name: input.name,
      description: input.description ?? null,
      address_line: input.addressLine,
      geog: `SRID=4326;POINT(${input.lng} ${input.lat})`,
      lat: input.lat,
      lng: input.lng,
    })
    .select("*")
    .single();
  if (error) throw error;

  const { error: verificationError } = await client
    .from("store_verification_requests")
    .insert({ store_id: data.id });
  if (verificationError) throw verificationError;

  const { error: roleError } = await client
    .from("profiles")
    .update({ role: "store_owner" })
    .eq("id", ownerId);
  if (roleError) throw roleError;

  return toDomain(data);
}
