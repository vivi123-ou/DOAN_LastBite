"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAddressAction } from "@/app/(customer)/account/addresses/actions";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";

const LocationPickerMap = dynamic(
  () => import("@/components/map/location-picker-map").then((mod) => mod.LocationPickerMap),
  { ssr: false }
);

const DEFAULT_CENTER: Coordinates = { lat: 10.7769, lng: 106.7009 };
const GEOCODE_DEBOUNCE_MS = 900;

// Same three ways to set a location as store-fields.tsx (GPS button, typed-
// address auto-geocode via /api/geocode, or drag/click the mini map) —
// this is the customer-facing equivalent of that same pattern, not a new
// one invented for addresses. Kept as its own component rather than
// generalizing store-fields.tsx into a shared one: that component also
// carries store-only fields (name/description/phone) that don't apply
// here, and the two forms' owners (store vs. account settings) are
// unlikely to ever need to change in lockstep.
export function AddressForm({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const lastGeocodedAddress = useRef("");

  useEffect(() => {
    const trimmed = addressLine.trim();
    if (trimmed.length < 5 || trimmed === lastGeocodedAddress.current) return;

    const timer = setTimeout(() => {
      setGeocoding(true);
      setGeocodeNotice(null);
      fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          lastGeocodedAddress.current = trimmed;
          if (data?.result) {
            setCoords({ lat: data.result.lat, lng: data.result.lng });
            setGeocodeNotice(null);
          } else {
            setGeocodeNotice("Không tìm được toạ độ cho địa chỉ này. Kéo ghim trên bản đồ để chỉnh.");
          }
        })
        .catch(() => setGeocodeNotice(null))
        .finally(() => setGeocoding(false));
    }, GEOCODE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [addressLine]);

  async function handleLocate() {
    setLocating(true);
    try {
      setCoords(await getCurrentPosition());
    } catch {
      toast.error("Không lấy được vị trí GPS. Vui lòng cho phép quyền định vị và thử lại.");
    } finally {
      setLocating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!coords) {
      toast.error("Vui lòng nhập địa chỉ hoặc lấy vị trí trước khi lưu.");
      return;
    }
    setSubmitting(true);
    try {
      await createAddressAction({
        label: label || undefined,
        addressLine,
        lat: coords.lat,
        lng: coords.lng,
      });
      toast.success("Đã lưu địa chỉ.");
      setLabel("");
      setAddressLine("");
      setCoords(null);
      onSaved?.();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-4">
      <div className="space-y-1.5">
        <Label htmlFor="address-label">Tên gợi nhớ (tuỳ chọn)</Label>
        <Input
          id="address-label"
          placeholder="Nhà riêng, Công ty..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="address-line">Địa chỉ</Label>
        <Input
          id="address-line"
          required
          placeholder="Số nhà, đường, quận, thành phố"
          value={addressLine}
          onChange={(e) => setAddressLine(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {geocoding
            ? "Đang tìm toạ độ từ địa chỉ..."
            : geocodeNotice ?? "Toạ độ sẽ tự cập nhật theo địa chỉ bạn nhập."}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label>Vị trí trên bản đồ</Label>
        <LocationPickerMap coords={coords ?? DEFAULT_CENTER} onChange={setCoords} />
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={handleLocate} disabled={locating}>
            <MapPin className="mr-2 size-4" />
            {locating ? "Đang lấy vị trí..." : "Dùng vị trí hiện tại"}
          </Button>
          {coords && (
            <span className="text-sm text-muted-foreground">
              {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </span>
          )}
        </div>
      </div>
      <Button type="submit" disabled={submitting}>
        {submitting ? "Đang lưu..." : "Lưu địa chỉ"}
      </Button>
    </form>
  );
}
