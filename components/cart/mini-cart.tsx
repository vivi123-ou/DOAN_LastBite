"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";

// Replaces the old cart-badge.tsx (a plain link to /cart) with an
// inbook.vn-style flyout: clicking the cart icon opens a short preview
// panel sliding in from the right (items + subtotal + "Xem giỏ hàng"),
// rather than navigating away immediately. The full /cart page is still
// where checkout itself happens — this is a preview, not a second
// checkout flow.
export function MiniCart() {
  const cart = useCart();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex items-center gap-1 p-2 hover:text-primary"
        aria-label="Giỏ hàng"
      >
        <ShoppingCart className="size-5" />
        {cart.itemCount > 0 && (
          <span className="absolute right-0 top-0 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {cart.itemCount > 9 ? "9+" : cart.itemCount}
          </span>
        )}
      </button>

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-0 top-16 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Always mounted so the slide-in transition actually animates. */}
      <div
        className={`fixed inset-y-16 right-0 z-50 flex w-full max-w-sm flex-col border-l bg-background shadow-xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-lg font-bold">Giỏ hàng</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Đóng"
            className="flex size-8 items-center justify-center rounded-full hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>

        {cart.items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <ShoppingCart className="size-10 text-muted-foreground/50" />
            Giỏ hàng của bạn đang trống.
          </div>
        ) : (
          <>
            <ul className="flex-1 space-y-3 overflow-y-auto p-4">
              {cart.items.map((item) => (
                <li key={item.comboId} className="flex items-center gap-3">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                      <img src={item.imageUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <ShoppingCart className="size-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {item.unitPrice.toLocaleString("vi-VN")}đ
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-primary">
                    {(item.unitPrice * item.quantity).toLocaleString("vi-VN")}đ
                  </p>
                </li>
              ))}
            </ul>

            <div className="space-y-3 border-t p-4">
              <div className="flex items-center justify-between font-semibold">
                <span>Tạm tính</span>
                <span className="text-primary">{cart.subtotal.toLocaleString("vi-VN")}đ</span>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setOpen(false)}
                  nativeButton={false}
                  render={<Link href="/cart">Xem giỏ hàng</Link>}
                />
                <Button
                  className="flex-1"
                  onClick={() => setOpen(false)}
                  nativeButton={false}
                  render={<Link href="/cart">Thanh toán</Link>}
                />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
