"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setPlacementTypeActiveAction } from "@/app/(admin)/admin/ads/actions";

export function PlacementTypeActiveToggle({ id, isActive }: { id: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(checked: boolean) {
    setPending(true);
    try {
      await setPlacementTypeActiveAction(id, checked);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPending(false);
    }
  }

  return <Switch checked={isActive} disabled={pending} onCheckedChange={handleChange} />;
}
