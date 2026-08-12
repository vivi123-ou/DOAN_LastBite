"use client";

import { useState } from "react";
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
}

// A cart only ever holds one store's items (see cart-context.tsx). This is
// the one place that decides what happens on conflict — prompts to clear
// the existing cart rather than silently mixing stores or silently
// refusing the add.
export function AddToCartButton({ item, disabled }: AddToCartButtonProps) {
  const cart = useCart();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function addToCart() {
    cart.addItem({ ...item, quantity: 1 });
    toast.success(`Đã thêm "${item.name}" vào giỏ hàng.`);
  }

  function handleAdd() {
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
