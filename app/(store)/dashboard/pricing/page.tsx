import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { listOwnTiers, listPlatformDefaultTiers } from "@/lib/repositories/bulk-discount.repository";
import { TiersManager } from "@/app/(store)/dashboard/pricing/_components/tiers-manager";

// Phase 4's last missing piece for bulk-buy discount: a store-dashboard UI
// to actually configure bulk_discount_tiers per store. Until now every
// store silently ran on the platform-wide default (store_id is null) seeded
// by 0021 — bulk-discount.repository.ts's listTiersForStore() already
// prefers a store's own tiers over the default the moment any exist, so
// this page is genuinely all that was missing, not a schema/RLS change.
export default async function PricingPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/pricing");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const [ownTiers, defaultTiers] = await Promise.all([
    listOwnTiers(supabase, store.id),
    listPlatformDefaultTiers(supabase),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Ưu đãi mua chung</h1>
        <p className="text-sm text-muted-foreground">
          Mức giảm áp dụng khi tổng số phần combo cả nhóm mua chung đạt đến ngưỡng bạn đặt ở đây.
          Chưa cấu hình gì thì cửa hàng dùng mức mặc định của hệ thống bên dưới.
        </p>
      </div>

      <TiersManager storeTiers={ownTiers} defaultTiers={defaultTiers} />
    </div>
  );
}
