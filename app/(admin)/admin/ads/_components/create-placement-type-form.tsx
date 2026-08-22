"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPlacementTypeAction } from "@/app/(admin)/admin/ads/actions";
import type { AdPlacementKey } from "@/lib/domain/ad";

const KEY_OPTIONS: { value: AdPlacementKey; label: string }[] = [
  { value: "hot_deal", label: "Nhãn HOT DEAL" },
  { value: "search_top", label: "Top tìm kiếm khu vực" },
  { value: "category_top", label: "Top ngành hàng" },
  { value: "homepage_banner", label: "Banner trang chủ" },
  { value: "diamond_partner", label: "Đối tác Kim Cương" },
];

export function CreatePlacementTypeForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState<AdPlacementKey>("hot_deal");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState("7");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createPlacementTypeAction({
        key,
        name,
        price: Number(price),
        durationDays: Number(durationDays),
        description: description || undefined,
      });
      toast.success("Đã tạo gói quảng cáo mới.");
      setName("");
      setPrice("");
      setDescription("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return <Button onClick={() => setOpen(true)}>Tạo gói quảng cáo mới</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="ad-type-key">Loại</Label>
          <select
            id="ad-type-key"
            value={key}
            onChange={(e) => setKey(e.target.value as AdPlacementKey)}
            className="block w-full rounded-md border bg-background px-2.5 py-1.5 text-sm"
          >
            {KEY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ad-type-name">Tên hiển thị</Label>
          <Input id="ad-type-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ad-type-price">Giá (đ)</Label>
          <Input
            id="ad-type-price"
            type="number"
            min={0}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ad-type-duration">Thời hạn (ngày)</Label>
          <Input
            id="ad-type-duration"
            type="number"
            min={1}
            required
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ad-type-description">Mô tả</Label>
        <Textarea
          id="ad-type-description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Tạo gói"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Huỷ
        </Button>
      </div>
    </form>
  );
}
