"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { useCart } from "@/lib/cart/cart-context";

// The one client island inside the otherwise server-rendered SiteHeader —
// cart contents are client/localStorage-only (see cart-context.tsx), so
// this can't be computed server-side.
export function CartBadge() {
  const { itemCount } = useCart();

  return (
    <Link href="/cart" className="relative flex items-center gap-1 hover:text-primary">
      <ShoppingCart className="size-5" />
      {itemCount > 0 && (
        <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
          {itemCount > 9 ? "9+" : itemCount}
        </span>
      )}
    </Link>
  );
}
