import { createAdminClient } from "@/lib/supabase/admin";
import { listStoreSubscriptionsForAdmin } from "@/lib/repositories/subscription.repository";
import type { SubscriptionStatus } from "@/lib/domain/subscription";
import { Badge } from "@/components/ui/badge";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  active: "Đang hoạt động",
  expired: "Đã hết hạn",
  cancelled: "Đã huỷ",
};

const VALID_STATUSES: SubscriptionStatus[] = ["pending_payment", "active", "expired", "cancelled"];

function parseStatus(raw: string | undefined): SubscriptionStatus | undefined {
  return VALID_STATUSES.find((s) => s === raw);
}

// Module-scope helper (not Date.now() inline in the component body) — same
// react-hooks/purity workaround already established in admin/combos/page.tsx.
function isPast(iso: string | null): boolean {
  return Boolean(iso && new Date(iso).getTime() <= Date.now());
}

export default async function AdminSubscriptionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status: rawStatus, page: rawPage } = await searchParams;
  const status = parseStatus(rawStatus);
  const page = Number(rawPage) > 0 ? Number(rawPage) : 1;
  const { items: rows, totalCount } = await listStoreSubscriptionsForAdmin(createAdminClient(), {
    search: q,
    status,
    page,
  });

  return (
    <div className="space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Trạng thái đăng ký gói</h1>
        <p className="text-sm text-muted-foreground">
          Gói mới nhất của từng cửa hàng đã từng mua gói. Cửa hàng chưa từng mua gói nào không hiện
          ở đây, coi như đang dùng gói Free mặc định. {totalCount} cửa hàng khớp bộ lọc.
        </p>
      </div>

      <AdminFilterBar
        searchPlaceholder="Tìm theo tên cửa hàng..."
        searchDefaultValue={q}
        selects={[
          {
            name: "status",
            defaultValue: rawStatus ?? "",
            options: [
              { value: "", label: "Tất cả trạng thái" },
              { value: "pending_payment", label: "Chờ thanh toán" },
              { value: "active", label: "Đang hoạt động" },
              { value: "expired", label: "Đã hết hạn" },
              { value: "cancelled", label: "Đã huỷ" },
            ],
          },
        ]}
        hasActiveFilter={Boolean(q || status)}
      />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Cửa hàng</th>
              <th className="px-3 py-2">Gói</th>
              <th className="px-3 py-2">Bắt đầu</th>
              <th className="px-3 py-2">Hết hạn</th>
              <th className="px-3 py-2">Đã trả</th>
              <th className="px-3 py-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => {
              const expiredNow = r.status === "active" && isPast(r.expiresAt);
              return (
                <tr key={r.storeId}>
                  <td className="px-3 py-2 font-medium">{r.storeName}</td>
                  <td className="px-3 py-2">{r.planName}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.startedAt ? new Date(r.startedAt).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.expiresAt ? new Date(r.expiresAt).toLocaleDateString("vi-VN") : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {r.amountPaid ? `${r.amountPaid.toLocaleString("vi-VN")}đ` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {expiredNow ? (
                      <Badge variant="destructive">Đã hết hạn</Badge>
                    ) : (
                      <Badge variant={r.status === "active" ? "default" : "outline"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            {q || status
              ? "Không tìm thấy cửa hàng nào khớp bộ lọc."
              : "Chưa có cửa hàng nào mua gói dịch vụ."}
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
