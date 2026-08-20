import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getSummary, sweepExpiredPoints } from "@/lib/repositories/net-zero.repository";
import { getInvite } from "@/lib/repositories/group-buy.repository";
import { CartView } from "@/app/(customer)/cart/_components/cart-view";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Promise<{ groupOrderId?: string }>;
}) {
  const { groupOrderId } = await searchParams;
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  // Sweep expired points first (admin client) so the balance offered here
  // — and auto-applied by default, see cart-view.tsx — never includes
  // points that should already be expired.
  if (userId) await sweepExpiredPoints(createAdminClient(), userId);
  const netZeroPointsBalance = userId ? (await getSummary(supabase, userId)).pointsBalance : 0;
  // Display-only — cart/actions.ts's createOrderAction re-resolves the
  // actual discount fresh at submit time regardless, never trusts this.
  const groupOrderInvite =
    groupOrderId && userId ? await getInvite(createAdminClient(), groupOrderId, userId) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-1 text-xs text-muted-foreground">
        <span>Trang chủ</span> / <span className="text-foreground">Giỏ hàng</span>
      </p>
      <h1 className="mb-6 text-2xl font-bold">Giỏ hàng của bạn</h1>
      <CartView
        isLoggedIn={Boolean(userId)}
        netZeroPointsBalance={netZeroPointsBalance}
        groupOrderId={groupOrderId}
        groupOrderInvite={groupOrderInvite}
      />
    </div>
  );
}
