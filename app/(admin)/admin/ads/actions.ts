"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPlacementType,
  setPlacementTypeActive,
  cancelBooking,
  markBookingPaidManually,
} from "@/lib/repositories/ad.repository";
import { createPlacementTypeSchema } from "@/lib/validation/ad.schema";
import { parseOrThrow } from "@/lib/validation/parse";

// Re-checked here, not just trusted from the layout guard — same posture
// as every other admin server action in this codebase.
async function requireAdmin() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const profile = await getById(supabase, userId);
  if (!profile || profile.role !== "admin") throw new Error("Bạn không có quyền truy cập trang này.");
}

export async function createPlacementTypeAction(input: unknown) {
  await requireAdmin();
  const parsed = parseOrThrow(createPlacementTypeSchema, input);
  await createPlacementType(createAdminClient(), parsed);
  revalidatePath("/admin/ads");
}

export async function setPlacementTypeActiveAction(id: string, isActive: boolean) {
  await requireAdmin();
  await setPlacementTypeActive(createAdminClient(), id, isActive);
  revalidatePath("/admin/ads");
}

// Manual resolution for a diamond_partner exclusivity conflict (or any
// other booking an admin decides to pull) — no real geo-exclusivity engine
// exists, so this is the actual mechanism behind "độc quyền khu vực":
// an admin looks at the overlapping active bookings and cancels one, with
// a note explaining why.
export async function cancelBookingAction(bookingId: string, note: string) {
  await requireAdmin();
  await cancelBooking(createAdminClient(), bookingId, note || undefined);
  revalidatePath("/admin/ads");
}

// The other half of "xét duyệt thủ công bởi quản trị viên" — an honest
// fallback for a gateway IPN that doesn't confirm in time, not an
// automated payment path. admin_note records that it was a manual
// override (markBookingPaidManually's own default text if left blank),
// distinct from a real gateway-confirmed one.
export async function markBookingPaidManuallyAction(bookingId: string, note: string) {
  await requireAdmin();
  await markBookingPaidManually(createAdminClient(), bookingId, note || undefined);
  revalidatePath("/admin/ads");
}
