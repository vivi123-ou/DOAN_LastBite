"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { toggleComboStatusAction } from "@/app/(store)/dashboard/combos/actions";
import type { ComboStatus } from "@/lib/domain/combo";

export function ComboStatusToggle({ comboId, status }: { comboId: string; status: ComboStatus }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Only active <-> paused is a manual owner action; locked/sold_out/draft
  // are system-driven states, not toggled from here.
  if (status !== "active" && status !== "paused") return null;

  function handleToggle() {
    startTransition(async () => {
      try {
        await toggleComboStatusAction(comboId, status === "active" ? "paused" : "active");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Có lỗi xảy ra");
        toast.error("Không thể cập nhật trạng thái combo.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleToggle} disabled={isPending}>
        {status === "active" ? "Tạm ngưng bán" : "Mở bán lại"}
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
