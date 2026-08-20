"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCart } from "@/lib/cart/cart-context";
import type { CartItem } from "@/lib/domain/order";

interface AddToCartButtonProps {
  item: Omit<CartItem, "quantity">;
  disabled?: boolean;
  // Set when arriving here via a group-buy invite's "Đặt hàng theo nhóm"
  // link (combos/[id]/page.tsx reads it from the URL) — after adding to
  // cart, sends the customer straight to /cart?groupOrderId=... instead of
  // just toasting and staying put, since checking out *as* the group order
  // (so the bulk discount actually applies) is the whole point of that
  // entry point.
  groupOrderId?: string;
  // True when the viewer's own store owns this combo. combos/[id]/page.tsx
  // already gates this server-side (isBuyable hides the button entirely for
  // isOwnStore), but every card grid (ComboCard — homepage carousels,
  // search results) renders this button directly with no equivalent check,
  // so it was silently adding a store owner's own combo to their own cart.
  // createOrderAction already rejects this at checkout time regardless
  // (defense-in-depth, cart/actions.ts), but that's a confusing place to
  // first find out — this stops it right at the click instead.
  isOwnStore?: boolean;
}

// A cart only ever holds one store's items (see cart-context.tsx). This is
// the one place that decides what happens on conflict — prompts to clear
// the existing cart rather than silently mixing stores or silently
// refusing the add.
export function AddToCartButton({ item, disabled, groupOrderId, isOwnStore }: AddToCartButtonProps) {
  const cart = useCart();
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function addToCart() {
    cart.addItem({ ...item, quantity: 1 });
    if (groupOrderId) {
      toast.success(`Đã thêm "${item.name}" vào giỏ hàng — tiếp tục đặt hàng theo nhóm.`);
      router.push(`/cart?groupOrderId=${groupOrderId}`);
    } else {
      toast.success(`Đã thêm "${item.name}" vào giỏ hàng.`);
    }
  }

  function handleAdd() {
    if (isOwnStore) {
      toast.error("Đây là combo của cửa hàng bạn — không thể tự mua.");
      return;
    }
    if (cart.storeId && cart.storeId !== item.storeId) {
      setConfirmOpen(true);
      return;
    }
    addToCart();
  }

  function handleConfirmReplace() {
    cart.clear();
    addToCart();
    setConfirmOpen(false);
  }

  return (
    <>
      <Button onClick={handleAdd} disabled={disabled} className="w-full">
        <ShoppingCart className="mr-2 size-4" />
        Thêm vào giỏ hàng
      </Button>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Giỏ hàng hiện có món từ cửa hàng khác</DialogTitle>
            <DialogDescription>
              Mỗi đơn hàng chỉ đặt được từ một cửa hàng. Thêm &quot;{item.name}&quot; sẽ xoá các
              món đang có trong giỏ (từ {cart.storeName}). Tiếp tục?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={handleConfirmReplace}>Xoá giỏ cũ &amp; thêm món này</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
