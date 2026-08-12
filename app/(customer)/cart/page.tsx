import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getSummary } from "@/lib/repositories/net-zero.repository";
import { CartView } from "@/app/(customer)/cart/_components/cart-view";

export default async function CartPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  const netZeroPointsBalance = userId ? (await getSummary(supabase, userId)).pointsBalance : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <p className="mb-1 text-xs text-muted-foreground">
        <span>Trang chủ</span> / <span className="text-foreground">Giỏ hàng</span>
      </p>
      <h1 className="mb-6 text-2xl font-bold">Giỏ hàng của bạn</h1>
      <CartView isLoggedIn={Boolean(userId)} netZeroPointsBalance={netZeroPointsBalance} />
    </div>
  );
}
