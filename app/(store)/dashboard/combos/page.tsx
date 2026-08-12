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
import type { Combo, ComboStatus } from "@/lib/domain/combo";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  active: "Đang bán",
  locked: "Đã hết hạn",
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

// There's no scheduled sweep that flips `status` to 'locked' once
// `best_before` passes (documented, still-manual gap — see CLAUDE.md §7),
// so a combo can be genuinely expired while its stored status still says
// 'active'. The homepage/search listings now filter this out at the query
// level (0011_best_before_listing_filter.sql), but the store's own combo
// list needs to *show* the real state rather than repeat the stale
// 'active' label — computed here for display only, not written back to
// the DB.
function displayStatus(combo: Combo): ComboStatus {
  if (combo.status === "active" && new Date(combo.bestBefore) <= new Date()) {
    return "locked";
  }
  return combo.status;
}

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
          nativeButton={false}
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
          {combos.map((combo) => {
            const status = displayStatus(combo);
            return (
              <Card key={combo.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg">{combo.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {combo.currentPrice.toLocaleString("vi-VN")}đ · còn {combo.remainingStock} ·
                      hạn dùng {new Date(combo.bestBefore).toLocaleString("vi-VN")}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <Button
                    variant={status === "locked" ? "outline" : "ghost"}
                    size="sm"
                    nativeButton={false}
                    render={
                      <Link href={`/dashboard/combos/${combo.id}/edit`}>
                        {status === "locked" ? "Bán lại" : "Chỉnh sửa"}
                      </Link>
                    }
                  />
                  <ComboStatusToggle comboId={combo.id} status={status} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
