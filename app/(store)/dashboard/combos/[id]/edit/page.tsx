import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { getById } from "@/lib/repositories/combo.repository";
import { listCategories } from "@/lib/repositories/category.repository";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ComboForm } from "@/app/(store)/dashboard/combos/_components/combo-form";

export default async function EditComboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect(`/login?next=/dashboard/combos/${id}/edit`);

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const combo = await getById(supabase, id);
  if (!combo || combo.storeId !== store.id) notFound();

  const categories = await listCategories(supabase);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Chỉnh sửa combo</CardTitle>
        </CardHeader>
        <CardContent>
          <ComboForm storeId={store.id} categories={categories} initialCombo={combo} />
        </CardContent>
      </Card>
    </div>
  );
}
