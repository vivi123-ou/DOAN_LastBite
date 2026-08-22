import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { getLocationsByIds } from "@/lib/repositories/store.repository";
import { create as createNotification } from "@/lib/repositories/notification.repository";

export interface ComboActivatedEvent {
  comboId: string;
  comboName: string;
  storeId: string;
  storeName: string;
}

// Same radius as the homepage's own default "gần bạn" search
// (combo.repository.ts's DEFAULT_RADIUS_M) — a combo that would show up on
// a customer's default homepage load is exactly what "near you" should mean
// here too, kept in sync deliberately rather than picked independently.
const NEARBY_RADIUS_M = 10_000;

// Subscribed to "combo.activated" via lib/events/app-events.ts. Always runs
// on the admin client (called from a server action/repository write path,
// never from the browser) — notifications has zero client-facing INSERT
// policy (same posture as payments), and nearby_customer_ids() itself needs
// no RLS since it only ever runs here.
export async function notifyNearbyCustomers(
  admin: SupabaseClient<Database>,
  event: ComboActivatedEvent
): Promise<void> {
  const locations = await getLocationsByIds(admin, [event.storeId]);
  const storeLocation = locations[event.storeId];
  // A store with no lat/lng on file (e.g. registered before GPS capture was
  // added) simply can't be the center of a radius search — skip silently,
  // same "no signal, no notification" posture as a customer with no saved
  // address at all.
  if (!storeLocation) return;

  const { data: rows, error } = await admin.rpc("nearby_customer_ids", {
    in_lat: storeLocation.lat,
    in_lng: storeLocation.lng,
    radius_m: NEARBY_RADIUS_M,
  });
  if (error) throw error;

  await Promise.all(
    (rows ?? []).map((row) =>
      createNotification(admin, {
        userId: row.user_id,
        type: "nearby_combo_activated",
        title: "Có combo mới gần bạn",
        body: `${event.storeName} vừa mở bán "${event.comboName}" gần khu vực bạn.`,
        payload: { comboId: event.comboId, storeId: event.storeId },
      }).catch(() => {})
    )
  );
}
