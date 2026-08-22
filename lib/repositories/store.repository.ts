import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type {
  RegisterStoreInput,
  Store,
  UpdateStoreInput,
  StoreBankAccount,
  UpdateBankAccountInput,
} from "@/lib/domain/store";

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
    bannerUrl: row.banner_url,
    phone: row.phone,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

// Public store detail lookup — the map's store detail panel
// (components/map/store-detail-panel.tsx) — stores_select_public RLS
// (0001) already scopes this to verified + active stores for any caller,
// same visibility rule as everywhere else customer-facing.
export async function getById(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<Store | null> {
  const { data, error } = await client.from("stores").select("*").eq("id", storeId).maybeSingle();
  if (error) throw error;
  return data ? toDomain(data) : null;
}

// Store picker for the group-buy invite flow (friends/[friendshipId]
// actions) — public read scoped to verified/active stores, same visibility
// rule already established for the rest of the customer-facing app
// (database-and-schema.md: "public reads on stores are scoped to
// verification_status='verified'"). Plain name-ordered list rather than a
// new search RPC — the invite picker is a small dropdown, not a full
// search UI.
export async function listVerified(
  client: SupabaseClient<Database>,
  limit = 50
): Promise<{ id: string; name: string }[]> {
  const { data, error } = await client
    .from("stores")
    .select("id, name")
    .eq("verification_status", "verified")
    .eq("is_active", true)
    .order("name")
    .limit(limit);
  if (error) throw error;
  return data;
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

// Used as a defense-in-depth check at checkout (a store can't buy from
// itself — see order.builder.ts / cart/actions.ts) — the primary gate is
// hiding "Thêm vào giỏ hàng" on the combo detail page for the store's own
// combos, this just guards the same rule server-side in case a cart built
// before that page-level check slips through.
export async function getOwnerIdById(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<string | null> {
  const { data, error } = await client.from("stores").select("owner_id").eq("id", storeId).maybeSingle();
  if (error) throw error;
  return data?.owner_id ?? null;
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
      phone: input.phone || null,
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

// stores_update_own RLS (0001) already scopes this to the caller's own
// store — regular client, same-actor write, no service-role needed.
export async function updateStore(
  client: SupabaseClient<Database>,
  storeId: string,
  input: UpdateStoreInput
): Promise<Store> {
  const { data, error } = await client
    .from("stores")
    .update({
      name: input.name,
      description: input.description ?? null,
      address_line: input.addressLine,
      geog: `SRID=4326;POINT(${input.lng} ${input.lat})`,
      lat: input.lat,
      lng: input.lng,
      phone: input.phone || null,
      ...(input.logoUrl !== undefined && { logo_url: input.logoUrl }),
      ...(input.bannerUrl !== undefined && { banner_url: input.bannerUrl }),
    })
    .eq("id", storeId)
    .select("*")
    .single();
  if (error) throw error;
  return toDomain(data);
}

// Deliberately its own table (store_bank_accounts, 0030), not columns on
// `stores` — see that migration's own comment. `store_bank_accounts_select_own`
// RLS already scopes this to the caller's own store when called with the
// regular client (the store's own /dashboard/store form); the admin
// payouts page instead calls this with the service-role client, which
// bypasses RLS the same way it does for every other cross-actor read in
// this codebase.
export async function getBankAccount(
  client: SupabaseClient<Database>,
  storeId: string
): Promise<StoreBankAccount | null> {
  const { data, error } = await client
    .from("store_bank_accounts")
    .select("store_id, bank_name, account_number, account_holder")
    .eq("store_id", storeId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    storeId: data.store_id,
    bankName: data.bank_name,
    accountNumber: data.account_number,
    accountHolder: data.account_holder,
  };
}

// Batched variant for the admin payouts list (service-role client — an
// admin needs every matching store's bank info in one screen, not just
// their own). Returns a Map for easy per-row lookup by the caller.
export async function listBankAccountsByStoreIds(
  admin: SupabaseClient<Database>,
  storeIds: string[]
): Promise<Map<string, StoreBankAccount>> {
  if (storeIds.length === 0) return new Map();
  const { data, error } = await admin
    .from("store_bank_accounts")
    .select("store_id, bank_name, account_number, account_holder")
    .in("store_id", storeIds);
  if (error) throw error;
  return new Map(
    data.map((row) => [
      row.store_id,
      {
        storeId: row.store_id,
        bankName: row.bank_name,
        accountNumber: row.account_number,
        accountHolder: row.account_holder,
      },
    ])
  );
}

// A store might not have a row yet (never filled this in) — upsert so the
// same form submission works whether this is the first save or an edit.
// Regular client only — store_bank_accounts has no admin-facing write
// policy at all (see 0030's comment: admin only ever reads this, never
// writes it).
export async function upsertBankAccount(
  client: SupabaseClient<Database>,
  storeId: string,
  input: UpdateBankAccountInput
): Promise<void> {
  const { error } = await client.from("store_bank_accounts").upsert(
    {
      store_id: storeId,
      bank_name: input.bankName || null,
      account_number: input.accountNumber || null,
      account_holder: input.accountHolder || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "store_id" }
  );
  if (error) throw error;
}
