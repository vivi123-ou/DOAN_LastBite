import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { listCombosForAdmin } from "@/lib/repositories/admin.repository";
import type { ComboStatus } from "@/lib/domain/combo";
import { Badge } from "@/components/ui/badge";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  active: "Đang bán",
  locked: "Đã khoá",
  sold_out: "Hết hàng",
  paused: "Tạm dừng",
};

const VALID_STATUSES: ComboStatus[] = ["draft", "active", "locked", "sold_out", "paused"];

function parseStatus(raw: string | undefined): ComboStatus | undefined {
  return VALID_STATUSES.find((s) => s === raw);
}

// Module-scope helper, not a `Date.now()` read hoisted into the component
// body — same shape as dashboard/combos/page.tsx's own displayStatus(),
// which the react-hooks/purity lint rule is fine with (it flags an impure
// call sitting directly in a component/hook body, not one behind a plain
// function boundary).
function isExpired(bestBefore: string): boolean {
  return new Date(bestBefore).getTime() <= Date.now();
}

// Read-only monitor — a store's own owner still manages their combos
// through /dashboard/combos; this page exists so an admin can see the
// dynamic-pricing/best-before mechanism actually working across the whole
// system, not just spot-check one store at a time. Same "display-only,
// computed fresh, never a stored discount step" price shown everywhere
// else in the app (combo.repository.ts's computeStockBasedDecayPrice()).
export default async function AdminCombosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status: rawStatus, page: rawPage } = await searchParams;
  const status = parseStatus(rawStatus);
  const page = Number(rawPage) > 0 ? Number(rawPage) : 1;
  const { items: combos, totalCount } = await listCombosForAdmin(createAdminClient(), {
    search: q,
    status,
    page,
  });

  return (
    <div className="space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Combo toàn hệ thống</h1>
        <p className="text-sm text-muted-foreground">
          {totalCount} combo khớp bộ lọc. Giá hiển thị là giá động tính tại thời điểm tải trang này.
        </p>
      </div>

      <AdminFilterBar
        searchPlaceholder="Tìm theo tên combo..."
        searchDefaultValue={q}
        selects={[
          {
            name: "status",
            defaultValue: rawStatus ?? "",
            options: [
              { value: "", label: "Tất cả trạng thái" },
              { value: "draft", label: "Nháp" },
              { value: "active", label: "Đang bán" },
              { value: "locked", label: "Đã khoá" },
              { value: "sold_out", label: "Hết hàng" },
              { value: "paused", label: "Tạm dừng" },
            ],
          },
        ]}
        hasActiveFilter={Boolean(q || status)}
      />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Combo</th>
              <th className="px-3 py-2">Cửa hàng</th>
              <th className="px-3 py-2">Giá</th>
              <th className="px-3 py-2">Tồn kho</th>
              <th className="px-3 py-2">Hạn bán</th>
              <th className="px-3 py-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {combos.map((c) => {
              const expired = isExpired(c.bestBefore);
              return (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    <Link href={`/admin/stores/${c.storeId}`} className="hover:underline hover:text-foreground">
                      {c.storeName}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium text-primary">
                      {c.currentPrice.toLocaleString("vi-VN")}đ
                    </span>
                    {c.currentPrice < c.originalPrice && (
                      <span className="ml-1.5 text-xs text-muted-foreground line-through">
                        {c.originalPrice.toLocaleString("vi-VN")}đ
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {c.remainingStock}/{c.initialStock}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {new Date(c.bestBefore).toLocaleString("vi-VN")}
                  </td>
                  <td className="px-3 py-2">
                    {expired && c.status === "active" ? (
                      <Badge variant="destructive">Đã hết hạn</Badge>
                    ) : (
                      <Badge variant={c.status === "active" ? "default" : "outline"}>
                        {STATUS_LABEL[c.status] ?? c.status}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {combos.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            {q || status ? "Không tìm thấy combo nào khớp bộ lọc." : "Chưa có combo nào."}
          </p>
        )}
      </div>

      <AdminPagination
        page={page}
        pageSize={20}
        totalCount={totalCount}
        searchParams={{ q, status: rawStatus }}
      />
    </div>
  );
}
