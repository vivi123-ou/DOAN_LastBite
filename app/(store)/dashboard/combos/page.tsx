import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { listByStore } from "@/lib/repositories/combo.repository";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { ComboStatusToggle } from "@/app/(store)/dashboard/combos/_components/combo-status-toggle";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  active: "Đang bán",
  locked: "Đã khoá (hết hạn)",
  sold_out: "Hết hàng",
  paused: "Tạm ngưng",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  active: "default",
  locked: "destructive",
  sold_out: "secondary",
  paused: "secondary",
};

export default async function StoreCombosPage() {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/combos");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  const combos = await listByStore(supabase, store.id);

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Combo của {store.name}</h1>
        <Button
          render={
            <Link href="/dashboard/combos/new">
              <Plus className="mr-2 size-4" />
              Tạo combo mới
            </Link>
          }
        />
      </div>

      {combos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Bạn chưa có combo nào. Tạo combo đầu tiên để bắt đầu bán đồ ăn cuối ngày.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {combos.map((combo) => (
            <Card key={combo.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg">{combo.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {combo.currentPrice.toLocaleString("vi-VN")}đ · còn {combo.remainingStock} ·
                    hạn dùng {new Date(combo.bestBefore).toLocaleString("vi-VN")}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[combo.status]}>{STATUS_LABEL[combo.status]}</Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  render={<Link href={`/dashboard/combos/${combo.id}/edit`}>Chỉnh sửa</Link>}
                />
                <ComboStatusToggle comboId={combo.id} status={combo.status} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
