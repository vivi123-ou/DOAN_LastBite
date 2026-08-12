"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Category } from "@/lib/domain/category";
import type { Combo, ComboItemInput } from "@/lib/domain/combo";
import { suggestBestBefore } from "@/lib/pricing/lock-duration/lock-duration.policy";
import { ComboImageUploader } from "@/app/(store)/dashboard/combos/_components/combo-image-uploader";
import { createComboAction, updateComboAction } from "@/app/(store)/dashboard/combos/actions";

interface ComboFormProps {
  storeId: string;
  categories: Category[];
  initialCombo?: Combo;
}

function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ComboForm({ storeId, categories, initialCombo }: ComboFormProps) {
  const router = useRouter();
  const isEdit = Boolean(initialCombo);

  const [categoryId, setCategoryId] = useState(initialCombo?.categoryId ?? categories[0]?.id ?? "");
  const [name, setName] = useState(initialCombo?.name ?? "");
  const [description, setDescription] = useState(initialCombo?.description ?? "");
  const [originalPrice, setOriginalPrice] = useState(String(initialCombo?.originalPrice ?? ""));
  const [initialStock, setInitialStock] = useState(String(initialCombo?.initialStock ?? ""));
  const [deliverySupported, setDeliverySupported] = useState(
    initialCombo?.deliverySupported ?? false
  );
  const [pickupSupported, setPickupSupported] = useState(initialCombo?.pickupSupported ?? true);
  const [items, setItems] = useState<ComboItemInput[]>(
    initialCombo?.items.map((i) => ({
      itemName: i.itemName,
      itemDescription: i.itemDescription ?? undefined,
      quantity: i.quantity,
    })) ?? [{ itemName: "", quantity: 1 }]
  );
  const [imageUrls, setImageUrls] = useState<string[]>(initialCombo?.images ?? []);
  const [customBestBefore, setCustomBestBefore] = useState(Boolean(initialCombo));
  const [bestBeforeLocal, setBestBeforeLocal] = useState(
    initialCombo ? toDatetimeLocal(initialCombo.bestBefore) : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const suggestedBestBefore = useMemo(
    () => (selectedCategory ? suggestBestBefore(selectedCategory) : null),
    [selectedCategory]
  );

  function updateItem(index: number, patch: Partial<ComboItemInput>) {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function addItem() {
    setItems((prev) => [...prev, { itemName: "", quantity: 1 }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const payload = {
      categoryId,
      name,
      description: description || undefined,
      originalPrice: Number(originalPrice),
      initialStock: Number(initialStock),
      bestBeforeOverride:
        customBestBefore && bestBeforeLocal ? new Date(bestBeforeLocal).toISOString() : undefined,
      deliverySupported,
      pickupSupported,
      items,
      imageUrls,
    };

    try {
      if (isEdit && initialCombo) {
        await updateComboAction(initialCombo.id, payload);
        toast.success("Đã cập nhật combo.");
      } else {
        await createComboAction(payload);
        toast.success("Đã tạo combo mới.");
      }
      router.push("/dashboard/combos");
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
          <Label htmlFor="combo-category">Loại combo</Label>
          <Select
            value={categoryId}
            onValueChange={(value) => setCategoryId(value ?? "")}
            items={categories.map((c) => ({ value: c.id, label: c.name }))}
          >
            <SelectTrigger id="combo-category">
              <SelectValue placeholder="Chọn loại combo" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="combo-name">Tên combo</Label>
          <Input id="combo-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="combo-description">Mô tả</Label>
        <Textarea
          id="combo-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="combo-price">Giá gốc (đ)</Label>
          <Input
            id="combo-price"
            type="number"
            min={1000}
            step={1000}
            required
            value={originalPrice}
            onChange={(e) => setOriginalPrice(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="combo-stock">Số lượng còn lại cuối ngày</Label>
          <Input
            id="combo-stock"
            type="number"
            min={1}
            required
            value={initialStock}
            onChange={(e) => setInitialStock(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2 rounded-md border p-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="custom-best-before">Giờ khoá bán (Best Before)</Label>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Tuỳ chỉnh</span>
            <Switch
              id="custom-best-before"
              checked={customBestBefore}
              onCheckedChange={setCustomBestBefore}
            />
          </div>
        </div>
        {!customBestBefore && suggestedBestBefore && (
          <p className="text-sm text-muted-foreground">
            Đề xuất tự động theo loại combo: khoá lúc{" "}
            <strong>{suggestedBestBefore.toLocaleString("vi-VN")}</strong>
          </p>
        )}
        {customBestBefore && (
          <Input
            type="datetime-local"
            value={bestBeforeLocal}
            onChange={(e) => setBestBeforeLocal(e.target.value)}
            required
          />
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-md border p-4">
          <Label htmlFor="pickup-supported">Cho khách tự đến lấy</Label>
          <Switch id="pickup-supported" checked={pickupSupported} onCheckedChange={setPickupSupported} />
        </div>
        <div className="flex items-center justify-between rounded-md border p-4">
          <Label htmlFor="delivery-supported">Hỗ trợ giao hàng</Label>
          <Switch
            id="delivery-supported"
            checked={deliverySupported}
            onCheckedChange={setDeliverySupported}
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Nội dung combo (khách sẽ thấy đúng những món này)</Label>
          <Button type="button" variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 size-4" />
            Thêm món
          </Button>
        </div>
        {items.map((item, index) => (
          <div key={index} className="flex items-start gap-2">
            <Input
              placeholder="Tên món (vd: Trà sữa trân châu size L)"
              required
              value={item.itemName}
              onChange={(e) => updateItem(index, { itemName: e.target.value })}
              className="flex-1"
            />
            <Input
              type="number"
              min={1}
              className="w-20"
              value={item.quantity}
              onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => removeItem(index)}
              disabled={items.length === 1}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Ảnh thật của combo</Label>
        <ComboImageUploader storeId={storeId} value={imageUrls} onChange={setImageUrls} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Đang lưu..." : isEdit ? "Lưu thay đổi" : "Tạo combo"}
      </Button>
    </form>
  );
}
