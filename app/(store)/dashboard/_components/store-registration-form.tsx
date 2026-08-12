"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { registerStoreAction } from "@/app/(store)/dashboard/actions";
import { StoreFields } from "@/app/(store)/dashboard/_components/store-fields";

export function StoreRegistrationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLocate() {
    setLocating(true);
    setError(null);
    try {
      setCoords(await getCurrentPosition());
    } catch {
      setError("Không lấy được vị trí GPS. Vui lòng cho phép quyền định vị và thử lại.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords) {
      setError("Vui lòng lấy vị trí cửa hàng trước khi đăng ký.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await registerStoreAction({
        name,
        description: description || undefined,
        phone: phone || undefined,
        addressLine,
        lat: coords.lat,
        lng: coords.lng,
      });
      toast.success("Đăng ký cửa hàng thành công! Đang chờ xác minh.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Đăng ký cửa hàng</CardTitle>
        <CardDescription>
          Cửa hàng cần được xác minh trước khi có thể đăng bán combo. Sau khi gửi, đội ngũ
          LastBite sẽ xét duyệt thông tin của bạn. Thông tin điền ở đây dùng chung với mục
          &quot;Thông tin cửa hàng&quot; sau này — bạn có thể thêm ảnh logo/banner ở đó khi cửa
          hàng đã được tạo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <StoreFields
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            phone={phone}
            onPhoneChange={setPhone}
            addressLine={addressLine}
            onAddressLineChange={setAddressLine}
            coords={coords}
            onCoordsChange={setCoords}
            onLocate={handleLocate}
            locating={locating}
          />

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Đang gửi..." : "Đăng ký cửa hàng"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
