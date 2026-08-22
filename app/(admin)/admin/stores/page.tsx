import { createAdminClient } from "@/lib/supabase/admin";
import { listStoresForAdmin } from "@/lib/repositories/admin.repository";
import type { AdminStoreSummary } from "@/lib/domain/admin";
import { AdminFilterBar } from "@/components/admin/admin-filter-bar";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { StoresList } from "@/app/(admin)/admin/stores/_components/stores-list";

const VALID_STATUSES: AdminStoreSummary["verificationStatus"][] = [
  "pending",
  "verified",
  "rejected",
  "suspended",
];

function parseStatus(raw: string | undefined): AdminStoreSummary["verificationStatus"] | undefined {
  return VALID_STATUSES.find((s) => s === raw);
}

export default async function AdminStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const { q, status: rawStatus, page: rawPage } = await searchParams;
  const status = parseStatus(rawStatus);
  const page = Number(rawPage) > 0 ? Number(rawPage) : 1;
  const { items: stores, totalCount } = await listStoresForAdmin(createAdminClient(), {
    search: q,
    status,
    page,
  });

  return (
    <div className="space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Cửa hàng</h1>
        <p className="text-sm text-muted-foreground">
          Duyệt hồ sơ cửa hàng mới, khoá/mở cửa hàng vi phạm. {totalCount} cửa hàng.
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
              { value: "pending", label: "Chờ duyệt" },
              { value: "verified", label: "Đã duyệt" },
              { value: "rejected", label: "Đã từ chối" },
              { value: "suspended", label: "Tạm ngưng" },
            ],
          },
        ]}
        hasActiveFilter={Boolean(q || status)}
      />

      {stores.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">
          {q || status ? "Không tìm thấy cửa hàng nào khớp bộ lọc." : "Chưa có cửa hàng nào."}
        </p>
      ) : (
        <StoresList stores={stores} />
      )}

      <AdminPagination
        page={page}
        pageSize={20}
        totalCount={totalCount}
        searchParams={{ q, status: rawStatus }}
      />
    </div>
  );
}
