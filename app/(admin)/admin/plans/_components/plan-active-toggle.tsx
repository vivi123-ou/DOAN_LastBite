"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { setPlanActiveAction } from "@/app/(admin)/admin/plans/actions";

export function PlanActiveToggle({ planId, isActive }: { planId: string; isActive: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleChange(checked: boolean) {
    setPending(true);
    try {
      await setPlanActiveAction(planId, checked);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPending(false);
    }
  }

  return <Switch checked={isActive} disabled={pending} onCheckedChange={handleChange} />;
}
