"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { registerStoreAction } from "@/app/(store)/dashboard/actions";

export function StoreRegistrationForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
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
          LastBite sẽ xét duyệt thông tin của bạn.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="store-name">Tên cửa hàng</Label>
            <Input id="store-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-description">Mô tả (tuỳ chọn)</Label>
            <Textarea
              id="store-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="store-address">Địa chỉ</Label>
            <Input
              id="store-address"
              required
              value={addressLine}
              onChange={(e) => setAddressLine(e.target.value)}
              placeholder="Số nhà, đường, quận, thành phố"
            />
          </div>

          <div className="space-y-2">
            <Label>Vị trí GPS</Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline" onClick={handleLocate} disabled={locating}>
                <MapPin className="mr-2 size-4" />
                {locating ? "Đang lấy vị trí..." : "Lấy vị trí hiện tại"}
              </Button>
              {coords && (
                <span className="text-sm text-muted-foreground">
                  {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Đứng tại cửa hàng khi bấm nút này để định vị chính xác — vị trí này dùng để hiển
              thị cửa hàng của bạn cho khách gần đó.
            </p>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Đang gửi..." : "Đăng ký cửa hàng"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
