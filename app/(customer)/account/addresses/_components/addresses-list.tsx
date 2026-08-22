"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MapPin, Star, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { deleteAddressAction, setDefaultAddressAction } from "@/app/(customer)/account/addresses/actions";
import type { Address } from "@/lib/domain/address";

export function AddressesList({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function handleSetDefault(id: string) {
    setPendingId(id);
    try {
      await setDefaultAddressAction(id);
      toast.success("Đã đặt làm địa chỉ mặc định.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Xoá địa chỉ này?")) return;
    setPendingId(id);
    try {
      await deleteAddressAction(id);
      toast.success("Đã xoá địa chỉ.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-2">
      {addresses.map((a) => (
        <Card key={a.id}>
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div className="flex items-start gap-2.5">
              <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {a.label || "Địa chỉ"}
                  {a.isDefault && (
                    <span className="flex items-center gap-0.5 text-xs font-normal text-primary">
                      <Star className="size-3 fill-primary" />
                      Mặc định
                    </span>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">{a.addressLine}</p>
              </div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              {!a.isDefault && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pendingId === a.id}
                  onClick={() => handleSetDefault(a.id)}
                >
                  Đặt mặc định
                </Button>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={pendingId === a.id}
                onClick={() => handleDelete(a.id)}
                aria-label="Xoá địa chỉ"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
