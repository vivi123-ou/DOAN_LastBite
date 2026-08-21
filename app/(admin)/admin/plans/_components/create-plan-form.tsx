"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createPlanAction } from "@/app/(admin)/admin/plans/actions";

export function CreatePlanForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [durationDays, setDurationDays] = useState("30");
  const [maxActiveCombos, setMaxActiveCombos] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createPlanAction({
        name,
        price: Number(price),
        durationDays: Number(durationDays),
        maxActiveCombos: maxActiveCombos === "" ? "" : Number(maxActiveCombos),
        description: description || undefined,
      });
      toast.success("Đã tạo gói mới.");
      setName("");
      setPrice("");
      setMaxActiveCombos("");
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
    return <Button onClick={() => setOpen(true)}>Tạo gói mới</Button>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-md border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="plan-name">Tên gói</Label>
          <Input id="plan-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-price">Giá (đ)</Label>
          <Input
            id="plan-price"
            type="number"
            min={0}
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-duration">Thời hạn (ngày)</Label>
          <Input
            id="plan-duration"
            type="number"
            min={1}
            required
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="plan-max-combos">Giới hạn combo (để trống = không giới hạn)</Label>
          <Input
            id="plan-max-combos"
            type="number"
            min={1}
            value={maxActiveCombos}
            onChange={(e) => setMaxActiveCombos(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="plan-description">Mô tả</Label>
        <Textarea
          id="plan-description"
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
