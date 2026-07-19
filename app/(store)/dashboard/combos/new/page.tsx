import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { listCategories } from "@/lib/repositories/category.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboForm } from "@/app/(store)/dashboard/combos/_components/combo-form";

export default async function NewComboPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/combos/new");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const categories = await listCategories(supabase);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Tạo combo mới</CardTitle>
        </CardHeader>
        <CardContent>
          <ComboForm storeId={store.id} categories={categories} />
        </CardContent>
      </Card>
    </div>
  );
}
