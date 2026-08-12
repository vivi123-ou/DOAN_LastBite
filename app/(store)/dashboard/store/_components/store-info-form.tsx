"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { updateStoreAction } from "@/app/(store)/dashboard/actions";
import { StoreFields } from "@/app/(store)/dashboard/_components/store-fields";
import { StoreImageUploader } from "@/app/(store)/dashboard/store/_components/store-image-uploader";
import type { Store } from "@/lib/domain/store";

// Same shared field set as the registration form (store-fields.tsx) — see
// its own comment for why — plus logo/banner uploaders, which only make
// sense here: they need an existing storeId to upload against
// (combo-images bucket's path convention), which a not-yet-registered
// account doesn't have yet.
export function StoreInfoForm({ store }: { store: Store }) {
  const router = useRouter();
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState(store.description ?? "");
  const [phone, setPhone] = useState(store.phone ?? "");
  const [addressLine, setAddressLine] = useState(store.addressLine);
  const [coords, setCoords] = useState<Coordinates | null>({ lat: store.lat, lng: store.lng });
  const [locating, setLocating] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(store.logoUrl);
  const [bannerUrl, setBannerUrl] = useState<string | null>(store.bannerUrl);
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
      setError("Vui lòng lấy vị trí cửa hàng.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updateStoreAction({
        name,
        description: description || undefined,
        phone: phone || undefined,
        addressLine,
        lat: coords.lat,
        lng: coords.lng,
        logoUrl,
        bannerUrl,
      });
      toast.success("Đã cập nhật thông tin cửa hàng.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Ảnh đại diện (logo)</Label>
          <StoreImageUploader
            storeId={store.id}
            label="Logo"
            value={logoUrl}
            onChange={setLogoUrl}
            aspectClassName="aspect-square max-w-40"
          />
        </div>
        <div className="space-y-2">
          <Label>Ảnh bìa (banner)</Label>
          <p className="text-xs text-muted-foreground">
            Hiển thị lớn ở đầu trang thông tin cửa hàng trên bản đồ.
          </p>
          <StoreImageUploader
            storeId={store.id}
            label="Banner"
            value={bannerUrl}
            onChange={setBannerUrl}
            aspectClassName="aspect-video"
          />
        </div>
      </div>

      <div className="space-y-4">
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
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Đang lưu..." : "Lưu thay đổi"}
      </Button>
    </form>
  );
}
