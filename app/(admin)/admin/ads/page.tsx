import { createAdminClient } from "@/lib/supabase/admin";
import { listAllPlacementTypesForAdmin, listBookingsForAdmin } from "@/lib/repositories/ad.repository";
import type { AdBookingStatus } from "@/lib/domain/ad";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { CreatePlacementTypeForm } from "@/app/(admin)/admin/ads/_components/create-placement-type-form";
import { PlacementTypeActiveToggle } from "@/app/(admin)/admin/ads/_components/placement-type-active-toggle";
import { CancelBookingButton } from "@/app/(admin)/admin/ads/_components/cancel-booking-button";

const STATUS_LABEL: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  active: "Đang chạy",
  expired: "Đã hết hạn",
  cancelled: "Đã huỷ",
};

const VALID_STATUSES: AdBookingStatus[] = ["pending_payment", "active", "expired", "cancelled"];

function parseStatus(raw: string | undefined): AdBookingStatus | undefined {
  return VALID_STATUSES.find((s) => s === raw);
}

// Admin module 3/3 (Quảng cáo & Vị trí Hiển thị) — the last of the three
// modules explicitly sequenced by the user. Two halves on one page: manage
// what's for sale (placement types, mirrors /admin/plans exactly), and
// oversee what's been bought — the diamond_partner rows specifically are
// where an admin does the actual "độc quyền khu vực" enforcement, since
// this app has no automated geo-exclusivity engine.
export default async function AdminAdsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status: rawStatus } = await searchParams;
  const status = parseStatus(rawStatus);
  const admin = createAdminClient();
  const [placementTypes, bookings] = await Promise.all([
    listAllPlacementTypesForAdmin(admin),
    listBookingsForAdmin(admin, { search: q, status }),
  ]);
  const diamondBookings = bookings.filter((b) => b.placementKey === "diamond_partner" && b.status === "active");

  return (
    <div className="space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Quảng cáo & Vị trí hiển thị</h1>
        <p className="text-sm text-muted-foreground">
          Sản phẩm mua thêm riêng, tách biệt với gói dịch vụ. Cửa hàng ở bất kỳ gói nào cũng có thể
          mua.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Các gói quảng cáo</h2>
        <CreatePlacementTypeForm />
        <div className="space-y-2">
          {placementTypes.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.name}</p>
                    <Badge variant="outline" className="capitalize">
                      {t.key.replace("_", " ")}
                    </Badge>
                    {!t.isActive && <Badge variant="secondary">Đã ẩn</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t.price.toLocaleString("vi-VN")}đ / {t.durationDays} ngày
                  </p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Đang bán</span>
                  <PlacementTypeActiveToggle id={t.id} isActive={t.isActive} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {diamondBookings.length > 1 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-destructive">
            Đối tác Kim Cương đang hoạt động ({diamondBookings.length}) · kiểm tra trùng khu vực
          </h2>
          <p className="text-sm text-muted-foreground">
            Hệ thống chưa tự động kiểm tra vùng địa lý trùng nhau. Xem danh sách bên dưới và huỷ
            bớt nếu có 2 cửa hàng cùng khu vực đều đang giữ huy hiệu này.
          </p>
          <div className="space-y-2">
            {diamondBookings.map((b) => (
              <Card key={b.id} className="border-destructive/30">
                <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{b.storeName}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.startsAt && new Date(b.startsAt).toLocaleDateString("vi-VN")} –{" "}
                      {b.endsAt && new Date(b.endsAt).toLocaleDateString("vi-VN")}
                    </p>
                  </div>
                  <CancelBookingButton bookingId={b.id} />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tất cả lượt mua quảng cáo</h2>
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
                { value: "active", label: "Đang chạy" },
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
                <th className="px-3 py-2">Combo</th>
                <th className="px-3 py-2">Thời gian</th>
                <th className="px-3 py-2">Lượt xem / bấm</th>
                <th className="px-3 py-2">Đã trả</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-medium">{b.storeName}</td>
                  <td className="px-3 py-2">{b.placementName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{b.comboName ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {b.startsAt && b.endsAt
                      ? `${new Date(b.startsAt).toLocaleDateString("vi-VN")} – ${new Date(b.endsAt).toLocaleDateString("vi-VN")}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {b.impressionCount} / {b.clickCount}
                  </td>
                  <td className="px-3 py-2">
                    {b.amountPaid ? `${b.amountPaid.toLocaleString("vi-VN")}đ` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={b.status === "active" ? "default" : "outline"}>
                      {STATUS_LABEL[b.status] ?? b.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bookings.length === 0 && (
            <p className="py-10 text-center text-muted-foreground">
              {q || status ? "Không tìm thấy lượt mua nào khớp bộ lọc." : "Chưa có lượt mua quảng cáo nào."}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
