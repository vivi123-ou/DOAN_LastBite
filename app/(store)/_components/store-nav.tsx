"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Tổng quan" },
  { href: "/dashboard/combos", label: "Combo" },
  { href: "/dashboard/orders", label: "Đơn hàng" },
];

export function StoreNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 py-2">
      {TABS.map((tab) => {
        const isActive =
          tab.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
