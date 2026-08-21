import { createAdminClient } from "@/lib/supabase/admin";
import { listStoresForAdmin } from "@/lib/repositories/admin.repository";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StoreActions } from "@/app/(admin)/admin/stores/_components/store-actions";

const VERIFICATION_LABEL: Record<string, string> = {
  pending: "Chờ duyệt",
  verified: "Đã duyệt",
  rejected: "Đã từ chối",
  suspended: "Tạm ngưng",
};

const VERIFICATION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  verified: "default",
  rejected: "destructive",
  suspended: "destructive",
};

export default async function AdminStoresPage() {
  const stores = await listStoresForAdmin(createAdminClient());

  return (
    <div className="space-y-4 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Cửa hàng</h1>
        <p className="text-sm text-muted-foreground">
          Duyệt hồ sơ cửa hàng mới, khoá/mở cửa hàng vi phạm. {stores.length} cửa hàng.
        </p>
      </div>

      {stores.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">Chưa có cửa hàng nào.</p>
      ) : (
        <div className="space-y-3">
          {stores.map((store) => (
            <Card key={store.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{store.name}</p>
                    <Badge variant={VERIFICATION_VARIANT[store.verificationStatus]}>
                      {VERIFICATION_LABEL[store.verificationStatus]}
                    </Badge>
                    {!store.isActive && <Badge variant="destructive">Đã khoá</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Chủ: {store.ownerName ?? "—"} · {store.addressLine}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Đăng ký {new Date(store.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <StoreActions store={store} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
