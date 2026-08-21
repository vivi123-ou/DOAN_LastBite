import { createAdminClient } from "@/lib/supabase/admin";
import { listUsersForAdmin } from "@/lib/repositories/admin.repository";
import type { UserRole } from "@/lib/domain/profile";
import { Badge } from "@/components/ui/badge";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";

const ROLE_LABEL: Record<string, string> = {
  customer: "Khách hàng",
  store_owner: "Chủ cửa hàng",
  admin: "Quản trị",
};

const VALID_ROLES: UserRole[] = ["customer", "store_owner", "admin"];

function parseRole(raw: string | undefined): UserRole | undefined {
  return VALID_ROLES.find((r) => r === raw);
}

// Email isn't shown here — profiles has no email column (Supabase Auth
// keeps that in its own auth.users, not exposed to this table), and
// resolving it would need the separate Auth admin API rather than a plain
// query. Name/role/points/order count already cover what "xem danh sách
// người dùng" actually needs; flagged as a possible follow-up, not built
// this round to keep scope to what a plain repository query can answer.
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>;
}) {
  const { q, role: rawRole } = await searchParams;
  const role = parseRole(rawRole);
  const users = await listUsersForAdmin(createAdminClient(), { search: q, role });

  return (
    <div className="space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Người dùng</h1>
        <p className="text-sm text-muted-foreground">
          200 tài khoản gần nhất khớp bộ lọc. {users.length} tài khoản.
        </p>
      </div>

      <AdminFilterBar
        searchPlaceholder="Tìm theo tên..."
        searchDefaultValue={q}
        selects={[
          {
            name: "role",
            defaultValue: rawRole ?? "",
            options: [
              { value: "", label: "Tất cả vai trò" },
              { value: "customer", label: "Khách hàng" },
              { value: "store_owner", label: "Chủ cửa hàng" },
              { value: "admin", label: "Quản trị" },
            ],
          },
        ]}
        hasActiveFilter={Boolean(q || role)}
      />

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Tên</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Số đơn đã đặt</th>
              <th className="px-3 py-2">Điểm Net Zero</th>
              <th className="px-3 py-2">Ngày đăng ký</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium">{u.fullName ?? "—"}</td>
                <td className="px-3 py-2">
                  <Badge variant={u.role === "admin" ? "default" : "outline"}>
                    {ROLE_LABEL[u.role] ?? u.role}
                  </Badge>
                </td>
                <td className="px-3 py-2">{u.orderCount}</td>
                <td className="px-3 py-2">{u.netZeroPoints.toLocaleString("vi-VN")}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(u.createdAt).toLocaleDateString("vi-VN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && (
          <p className="py-10 text-center text-muted-foreground">
            {q || role ? "Không tìm thấy tài khoản nào khớp bộ lọc." : "Chưa có người dùng nào."}
          </p>
        )}
      </div>
    </div>
  );
}
