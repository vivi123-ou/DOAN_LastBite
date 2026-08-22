import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { listForUser } from "@/lib/repositories/address.repository";
import { AddressesList } from "@/app/(customer)/account/addresses/_components/addresses-list";
import { AddressForm } from "@/app/(customer)/account/addresses/_components/address-form";

// Direct follow-up to the proximity-notification round: "combo mới gần
// bạn" only ever had delivery-order addresses to work with, since there
// was no dedicated "địa chỉ của tôi" screen — a customer who only ever
// picks up in person had nothing on file at all. This gives every customer
// a real, standalone place to add a home/work address, independent of ever
// placing a delivery order. Same `addresses` table (dormant since phase 1,
// see database-and-schema.md's table inventory) — this is its second real
// writer, not a new table.
export default async function AddressesPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/account/addresses");

  const addresses = await listForUser(supabase, userId);

  return (
    <div className="space-y-6 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold">Địa chỉ của tôi</h1>
        <p className="text-sm text-muted-foreground">
          Lưu địa chỉ nhà hoặc chỗ làm để nhận thông báo khi có combo mới gần bạn, và điền nhanh hơn
          khi đặt giao hàng.
        </p>
      </div>

      {addresses.length > 0 ? (
        <AddressesList addresses={addresses} />
      ) : (
        <p className="text-sm text-muted-foreground">Bạn chưa lưu địa chỉ nào.</p>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Thêm địa chỉ mới</h2>
        <AddressForm />
      </div>
    </div>
  );
}
