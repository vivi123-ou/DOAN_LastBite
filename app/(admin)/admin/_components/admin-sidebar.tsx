"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, LayoutDashboard, Store, Package, Flag, Users } from "lucide-react";

const ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/stores", label: "Cửa hàng", icon: Store },
  { href: "/admin/combos", label: "Combo", icon: Package },
  { href: "/admin/reports", label: "Báo cáo", icon: Flag },
  { href: "/admin/users", label: "Người dùng", icon: Users },
];

// Same persistent-sidebar shape as StoreSidebar (app/(store)/_components/store-sidebar.tsx)
// — one more "you're in a different mode now" area, consistent visual
// language with the store dashboard's own Studio-style split.
export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row flex-wrap items-center gap-1 sm:flex-col sm:items-stretch">
      <Link
        href="/"
        className="mb-1 flex shrink-0 items-center gap-2.5 rounded-full border border-dashed px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary sm:mb-2"
      >
        <ArrowLeft className="size-4" />
        Về trang người dùng
      </Link>
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
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
