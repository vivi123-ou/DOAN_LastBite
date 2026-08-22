"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ComboStatusToggle } from "@/app/(store)/dashboard/combos/_components/combo-status-toggle";
import { BulkRelistDialog } from "@/app/(store)/dashboard/combos/_components/bulk-relist-dialog";
import type { Combo, ComboStatus } from "@/lib/domain/combo";

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  active: "Đang bán",
  locked: "Đã hết hạn",
  sold_out: "Hết hàng",
  paused: "Tạm ngưng",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "outline",
  active: "default",
  locked: "destructive",
  sold_out: "secondary",
  paused: "secondary",
};

// Same computed-display-status logic as the old page.tsx (and admin's own
// copy, admin/combos/page.tsx's isExpired()) — see that entry's comment.
// Duplicated rather than shared: this exact small pattern is already
// duplicated per-file elsewhere in this codebase for the same reason.
function displayStatus(combo: Combo): ComboStatus {
  if (combo.status === "active" && new Date(combo.bestBefore) <= new Date()) {
    return "locked";
  }
  return combo.status;
}

interface CombosListProps {
  combos: Combo[];
  suggestedBestBeforeByComboId: Record<string, string>;
}

// Checkboxes only ever appear on expired ("locked") combos — an active/
// draft/paused combo has nothing to "bán lại" yet. Selecting several and
// bulk-relisting opens one compact confirmation dialog (BulkRelistDialog)
// rather than instantly reapplying old data — see that component's own
// comment for why a relist's stock count specifically can't be silently
// bulk-defaulted (food-safety/inventory-honesty reasoning, not just UX).
export function CombosList({ combos, suggestedBestBeforeByComboId }: CombosListProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);

  const expiredCombos = combos.filter((c) => displayStatus(c) === "locked");
  const allExpiredSelected = expiredCombos.length > 0 && expiredCombos.every((c) => selected.has(c.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected(allExpiredSelected ? new Set() : new Set(expiredCombos.map((c) => c.id)));
  }

  const selectedRows = combos
    .filter((c) => selected.has(c.id))
    .map((c) => ({
      comboId: c.id,
      name: c.name,
      lastStock: c.initialStock,
      suggestedBestBefore: suggestedBestBeforeByComboId[c.id],
    }))
    .filter((r) => r.suggestedBestBefore);

  return (
    <div className="space-y-3">
      {expiredCombos.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" className="size-4" checked={allExpiredSelected} onChange={toggleAll} />
            Chọn tất cả combo đã hết hạn ({expiredCombos.length})
          </label>
          <span className="text-muted-foreground">
            {selected.size > 0 ? `${selected.size} đã chọn` : null}
          </span>
          <Button size="sm" disabled={selected.size === 0} onClick={() => setDialogOpen(true)}>
            Bán lại đã chọn{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      )}

      {combos.map((combo) => {
        const status = displayStatus(combo);
        return (
          <Card key={combo.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                {status === "locked" && (
                  <input
                    type="checkbox"
                    className="mt-1.5 size-4 shrink-0"
                    checked={selected.has(combo.id)}
                    onChange={() => toggle(combo.id)}
                    aria-label={`Chọn ${combo.name}`}
                  />
                )}
                <div>
                  <CardTitle className="text-lg">{combo.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {combo.currentPrice.toLocaleString("vi-VN")}đ · còn {combo.remainingStock} ·
                    hạn dùng {new Date(combo.bestBefore).toLocaleString("vi-VN")}
                  </p>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <Button
                variant={status === "locked" ? "outline" : "ghost"}
                size="sm"
                nativeButton={false}
                render={
                  <Link href={`/dashboard/combos/${combo.id}/edit`}>
                    {status === "locked" ? "Bán lại" : "Chỉnh sửa"}
                  </Link>
                }
              />
              <ComboStatusToggle comboId={combo.id} status={status} />
            </CardContent>
          </Card>
        );
      })}

      {dialogOpen && (
        <BulkRelistDialog
          key={selectedRows.map((r) => r.comboId).join(",")}
          onClose={() => setDialogOpen(false)}
          rows={selectedRows}
        />
      )}
    </div>
  );
}
