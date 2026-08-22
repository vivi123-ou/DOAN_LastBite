import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { Address, SaveAddressInput } from "@/lib/domain/address";

type AddressRow = Database["public"]["Tables"]["addresses"]["Row"];

function toDomain(row: AddressRow): Address {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    addressLine: row.address_line,
    lat: row.lat ?? 0,
    lng: row.lng ?? 0,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

// addresses_all_own RLS (0001) already covers every operation below
// (select/insert/update/delete, all scoped to user_id = auth.uid()) —
// regular client throughout, same-actor writes only.
export async function listForUser(client: SupabaseClient<Database>, userId: string): Promise<Address[]> {
  const { data, error } = await client
    .from("addresses")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map(toDomain);
}

// A first saved address is automatically the default — there'd otherwise be
// no default at all until the customer explicitly picks one, which is a
// worse initial state than just picking the obvious choice for them.
export async function create(
  client: SupabaseClient<Database>,
  userId: string,
  input: SaveAddressInput
): Promise<Address> {
  const { count, error: countError } = await client
    .from("addresses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (countError) throw countError;

  const { data, error } = await client
    .from("addresses")
    .insert({
      user_id: userId,
      label: input.label ?? null,
      address_line: input.addressLine,
      geog: `SRID=4326;POINT(${input.lng} ${input.lat})`,
      lat: input.lat,
      lng: input.lng,
      is_default: input.isDefault ?? (count ?? 0) === 0,
    })
    .select("*")
    .single();
  if (error) throw error;

  if (data.is_default) await clearOtherDefaults(client, userId, data.id);
  return toDomain(data);
}

export async function update(
  client: SupabaseClient<Database>,
  addressId: string,
  input: SaveAddressInput
): Promise<void> {
  const { error } = await client
    .from("addresses")
    .update({
      label: input.label ?? null,
      address_line: input.addressLine,
      geog: `SRID=4326;POINT(${input.lng} ${input.lat})`,
      lat: input.lat,
      lng: input.lng,
    })
    .eq("id", addressId);
  if (error) throw error;
}

export async function remove(client: SupabaseClient<Database>, addressId: string): Promise<void> {
  const { error } = await client.from("addresses").delete().eq("id", addressId);
  if (error) throw error;
}

// Only one address per customer can be the default at a time — clear every
// other row's flag before/after setting the new one, rather than a DB
// constraint (a partial unique index on (user_id) where is_default would
// work too, but this table predates that need and two small updates here
// is simpler than an additive migration just for this).
async function clearOtherDefaults(
  client: SupabaseClient<Database>,
  userId: string,
  keepId: string
): Promise<void> {
  const { error } = await client
    .from("addresses")
    .update({ is_default: false })
    .eq("user_id", userId)
    .neq("id", keepId);
  if (error) throw error;
}

export async function setDefault(
  client: SupabaseClient<Database>,
  userId: string,
  addressId: string
): Promise<void> {
  const { error } = await client.from("addresses").update({ is_default: true }).eq("id", addressId);
  if (error) throw error;
  await clearOtherDefaults(client, userId, addressId);
}
