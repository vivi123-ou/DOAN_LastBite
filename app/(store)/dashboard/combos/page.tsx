import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
import { listByStore } from "@/lib/repositories/combo.repository";
import { listCategories } from "@/lib/repositories/category.repository";
import { suggestBestBefore } from "@/lib/pricing/lock-duration/lock-duration.policy";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { CombosList } from "@/app/(store)/dashboard/combos/_components/combos-list";
import type { Combo, ComboStatus } from "@/lib/domain/combo";

const VALID_STATUSES: ComboStatus[] = ["draft", "active", "locked", "sold_out", "paused"];

function parseStatus(raw: string | undefined): ComboStatus | undefined {
  return VALID_STATUSES.find((s) => s === raw);
}

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

export default async function StoreCombosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status: rawStatus } = await searchParams;
  const status = parseStatus(rawStatus);

  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/dashboard/combos");

  const store = await getStoreByOwnerId(supabase, userId);
  if (!store) redirect("/dashboard");

  // A store's own combo count realistically stays small (tens, not
  // thousands) — unlike the admin lists, this doesn't need real
  // server-side pagination/index-backed search; a plain in-memory filter
  // over listByStore()'s existing result is proportionate to the actual
  // scale here.
  const [allCombos, categories] = await Promise.all([
    listByStore(supabase, store.id),
    listCategories(supabase),
  ]);
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  const needle = q?.trim().toLowerCase();
  const combos = allCombos.filter((combo) => {
    if (needle && !combo.name.toLowerCase().includes(needle)) return false;
    if (status && displayStatus(combo) !== status) return false;
    return true;
  });

  // Every expired combo's own suggested relist time — computed once here
  // (not on every checkbox toggle client-side) since it needs each
  // combo's real Category row. Feeds both the per-row default and the bulk
  // dialog's "same time for all" upper bound.
  const suggestedBestBeforeByComboId: Record<string, string> = {};
  for (const combo of combos) {
    const category = categoryById.get(combo.categoryId);
    if (category) {
      suggestedBestBeforeByComboId[combo.id] = suggestBestBefore(category).toISOString();
    }
  }

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

      <form method="get" className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          name="q"
          placeholder="Tìm theo tên combo..."
          defaultValue={q}
          className="min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm sm:max-w-xs"
        />
        <select
          name="status"
          defaultValue={rawStatus ?? ""}
          className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="active">Đang bán</option>
          <option value="locked">Đã hết hạn</option>
          <option value="sold_out">Hết hàng</option>
          <option value="paused">Tạm dừng</option>
          <option value="draft">Nháp</option>
        </select>
        <button
          type="submit"
          className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground"
        >
          Lọc
        </button>
        {(q || status) && (
          <a href="/dashboard/combos" className="text-sm text-muted-foreground underline underline-offset-2">
            Xoá lọc
          </a>
        )}
      </form>

      {allCombos.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Bạn chưa có combo nào. Tạo combo đầu tiên để bắt đầu bán đồ ăn cuối ngày.
          </CardContent>
        </Card>
      ) : combos.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          Không tìm thấy combo nào khớp bộ lọc.
        </p>
      ) : (
        <CombosList combos={combos} suggestedBestBeforeByComboId={suggestedBestBeforeByComboId} />
      )}
    </div>
  );
}
