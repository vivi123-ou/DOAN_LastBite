"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, Receipt } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/dashboard/combos", label: "Combo", icon: Package },
  { href: "/dashboard/orders", label: "Đơn hàng", icon: Receipt },
];

// Vertical, persistent-sidebar version of the store nav (see
// app/(store)/layout.tsx) — the "you're in a different mode now" signal for
// the store area, YouTube Studio-style. Same filled-pill active state as
// components/layout/main-nav.tsx for a consistent visual language between
// the two nav levels.
export function StoreSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row gap-1 overflow-x-auto sm:flex-col sm:overflow-visible">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
