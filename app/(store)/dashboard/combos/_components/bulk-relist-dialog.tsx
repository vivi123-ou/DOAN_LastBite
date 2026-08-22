"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { bulkRelistAction } from "@/app/(store)/dashboard/combos/actions";

export interface BulkRelistRow {
  comboId: string;
  name: string;
  // Last-known initial_stock — used only as a *starting point* to reduce
  // typing (a store selling the same combo daily often makes a similar
  // batch size), never applied silently: the input stays fully editable
  // and the store has to look at it before hitting the one confirm button.
  lastStock: number;
  // Computed server-side (page.tsx) from this combo's own category —
  // the ceiling any per-row or shared time can't go past, per the same
  // business rule combo.builder.ts enforces on a single relist
  // (never later than the category's own suggested Best Before).
  suggestedBestBefore: string;
  // Premium-tier "gợi ý nhập hàng" (order.repository.ts's
  // getAverageDailySales()) — average units actually sold per day over the
  // last 7 days, shown as a hint only, never auto-filled into the input:
  // the whole point of this dialog is that the store looks at and confirms
  // a real number, not that the system picks one for them.
  suggestedQuantity: number | null;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

// "YYYY-MM-DDTHH:mm" — what <input type="datetime-local"> needs for both
// its value and its max attribute.
function toDatetimeLocal(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function earliestSuggestedTime(rows: BulkRelistRow[]): string | null {
  return rows.reduce<string | null>(
    (min, r) => (min === null || r.suggestedBestBefore < min ? r.suggestedBestBefore : min),
    null
  );
}

// The one compact screen that replaces opening the full edit form N times.
// Deliberately requires the store to see and confirm a real stock number
// per combo rather than silently reapplying whatever was last saved —
// "Bán lại" means a *new* batch of food, and the whole point of Best
// Before/no-mystery-bags in this app is that customers see a real,
// accurate quantity, not a stale one carried over blind. Best Before
// itself defaults per-row to each combo's own category-suggested time
// (already valid, no further server check needed) with an optional shared
// override — capped at the *earliest* of the selected rows' own suggested
// times, so it's structurally impossible to pick a time that would violate
// the per-category rule for any row in the batch.
//
// No `open` prop / no effect re-seeding state on open — the parent
// (combos-list.tsx) only mounts this component while the dialog should be
// visible, keyed by the selection itself, so a fresh mount always starts
// from correct initial state via plain useState initializers. Same
// "remount instead of reset-in-an-effect" escape hatch already used
// elsewhere in this app for the identical react-hooks/set-state-in-effect
// situation (see map-view.tsx's store-detail-panel remount).
export function BulkRelistDialog({ onClose, rows }: { onClose: () => void; rows: BulkRelistRow[] }) {
  const router = useRouter();
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.comboId, String(r.lastStock)]))
  );
  const [useSharedTime, setUseSharedTime] = useState(false);
  const [sharedTime, setSharedTime] = useState(() => {
    const earliest = earliestSuggestedTime(rows);
    return earliest ? toDatetimeLocal(earliest) : "";
  });
  const [submitting, setSubmitting] = useState(false);

  const maxSharedTime = earliestSuggestedTime(rows);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const items = rows.map((r) => ({
        comboId: r.comboId,
        initialStock: Number(quantities[r.comboId]) || 0,
        bestBefore: useSharedTime && sharedTime ? new Date(sharedTime).toISOString() : r.suggestedBestBefore,
      }));
      await bulkRelistAction({ items });
      toast.success(`Đã bán lại ${items.length} combo.`);
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bán lại {rows.length} combo</DialogTitle>
          <DialogDescription>
            Kiểm tra lại số lượng thực tế hôm nay cho từng combo trước khi xác nhận. Hạn bán mới
            được tự đề xuất theo loại combo.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-80 space-y-3 overflow-y-auto">
          {rows.map((row) => (
            <div key={row.comboId} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{row.name}</p>
                {row.suggestedQuantity !== null && (
                  <p className="text-xs text-muted-foreground">
                    Gợi ý: trung bình bán {row.suggestedQuantity} phần/ngày (7 ngày qua)
                  </p>
                )}
              </div>
              <Input
                type="number"
                min={1}
                max={999}
                className="w-24"
                value={quantities[row.comboId] ?? ""}
                onChange={(e) => setQuantities((prev) => ({ ...prev, [row.comboId]: e.target.value }))}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2 border-t pt-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={useSharedTime}
              onChange={(e) => setUseSharedTime(e.target.checked)}
            />
            Đặt cùng 1 giờ hết hạn cho tất cả (mặc định: mỗi combo dùng giờ đề xuất riêng)
          </label>
          {useSharedTime && (
            <div className="space-y-1.5">
              <Label htmlFor="shared-best-before">Giờ hết hạn chung</Label>
              <input
                id="shared-best-before"
                type="datetime-local"
                value={sharedTime}
                max={maxSharedTime ? toDatetimeLocal(maxSharedTime) : undefined}
                onChange={(e) => setSharedTime(e.target.value)}
                className="block rounded-md border px-2.5 py-1.5 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Không thể muộn hơn giờ đề xuất sớm nhất trong các combo đã chọn, để đảm bảo an toàn
                thực phẩm cho mọi loại combo.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Huỷ
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rows.length === 0}>
            {submitting ? "Đang lưu..." : "Xác nhận bán lại"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
