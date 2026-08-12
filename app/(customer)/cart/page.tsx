import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { CartView } from "@/app/(customer)/cart/_components/cart-view";

export default async function CartPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Giỏ hàng</h1>
      <CartView isLoggedIn={Boolean(userId)} />
    </div>
  );
}
