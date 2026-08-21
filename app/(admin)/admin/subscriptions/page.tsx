import { createAdminClient } from "@/lib/supabase/admin";
import { listStoreSubscriptionsForAdmin } from "@/lib/repositories/subscription.repository";
import { Badge } from "@/components/ui/badge";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  active: "Đang hoạt động",
  expired: "Đã hết hạn",
  cancelled: "Đã huỷ",
};

// Module-scope helper (not Date.now() inline in the component body) — same
// react-hooks/purity workaround already established in admin/combos/page.tsx.
function isPast(iso: string | null): boolean {
  return Boolean(iso && new Date(iso).getTime() <= Date.now());
}

export default async function AdminSubscriptionsPage() {
  const rows = await listStoreSubscriptionsForAdmin(createAdminClient());

  return (
    <div className="space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Trạng thái đăng ký gói</h1>
        <p className="text-sm text-muted-foreground">
          Gói mới nhất của từng cửa hàng đã từng mua gói. Cửa hàng chưa từng mua gói nào không hiện
          ở đây — coi như đang dùng gói Free mặc định.
        </p>
      </div>

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
            Chưa có cửa hàng nào mua gói dịch vụ.
          </p>
        )}
      </div>
    </div>
  );
}
