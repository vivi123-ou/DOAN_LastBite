"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCart } from "@/lib/cart/cart-context";

// Anchored dropdown under the header's cart button — same proven shape as
// notification-bell.tsx / site-search-filters.tsx (`absolute right-0
// top-full ... bg-popover`), not a `fixed` slide-in side panel. The earlier
// `fixed`-panel version (even after portaling to document.body) kept
// rendering with a transparent/mispositioned background and, worse, let the
// whole page scroll horizontally to reveal it sitting outside the
// viewport — a `fixed`-position element computes its offsets against
// whichever ancestor happens to establish a containing block (`backdrop-
// blur` on the header did, elsewhere in this app `transform`/`filter` on a
// map wrapper did too), which is exactly the class of bug this project has
// hit more than once. An `absolute`-positioned dropdown anchored to this
// component's own `relative` wrapper has no such ambiguity — it's normal
// document flow, contained naturally within the page, matching the same
// "revert to a simpler anchored dropdown" call already made for
// site-menu.tsx after a similar `fixed`+backdrop layout bug there.
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
        className="relative flex items-center gap-1.5 rounded-md p-2 text-sm font-medium hover:bg-muted hover:text-primary"
        aria-label="Giỏ hàng"
      >
        <span className="relative">
          <ShoppingCart className="size-5" />
          {cart.itemCount > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
              {cart.itemCount > 9 ? "9+" : cart.itemCount}
            </span>
          )}
        </span>
        <span className="hidden sm:inline">Giỏ hàng</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-md border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">Giỏ hàng</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          {cart.items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
              <ShoppingCart className="size-10 text-muted-foreground/50" />
              Giỏ hàng của bạn đang trống.
            </div>
          ) : (
            <ul className="max-h-80 space-y-3 overflow-y-auto p-4">
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
          )}

          {/* Always shown, even when the cart is empty — "Xem giỏ hàng" is
              the way out to /cart (and checkout from there) regardless of
              cart state. */}
          <div className="space-y-3 border-t p-4">
            {cart.items.length > 0 && (
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Tạm tính</span>
                <span className="text-primary">{cart.subtotal.toLocaleString("vi-VN")}đ</span>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setOpen(false)}
                nativeButton={false}
                render={<Link href="/cart">Xem giỏ hàng</Link>}
              />
              {cart.items.length > 0 && (
                <Button
                  className="flex-1"
                  onClick={() => setOpen(false)}
                  nativeButton={false}
                  render={<Link href="/cart">Thanh toán</Link>}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
