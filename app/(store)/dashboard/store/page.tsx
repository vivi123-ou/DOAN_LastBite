import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId, getBankAccount } from "@/lib/repositories/store.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StoreInfoForm } from "@/app/(store)/dashboard/store/_components/store-info-form";
import { BankAccountForm } from "@/app/(store)/dashboard/store/_components/bank-account-form";

export default async function StoreInfoPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/store");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const bankAccount = await getBankAccount(supabase, store.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Thông tin cửa hàng</CardTitle>
        </CardHeader>
        <CardContent>
          <StoreInfoForm store={store} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin nhận thanh toán</CardTitle>
        </CardHeader>
        <CardContent>
          <BankAccountForm bankAccount={bankAccount} />
        </CardContent>
      </Card>
    </div>
  );
}
