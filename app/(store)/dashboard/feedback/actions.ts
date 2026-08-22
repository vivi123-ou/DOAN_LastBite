"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { respondToReport } from "@/lib/repositories/review.repository";

// combo_reviews_update_store_owner RLS (0034) already scopes the actual
// write to reports about this store owner's own store — this action's own
// "do you even have a store" check is just for a clear error message, same
// posture as every other store-scoped action file.
export async function respondToReportAction(reviewId: string, response: string) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) throw new Error("Bạn cần đăng nhập trước.");
  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) throw new Error("Bạn cần đăng ký cửa hàng trước.");

  const trimmed = response.trim();
  if (!trimmed) throw new Error("Vui lòng nhập nội dung phản hồi.");

  await respondToReport(supabase, reviewId, trimmed);
  revalidatePath("/dashboard/feedback");
}
