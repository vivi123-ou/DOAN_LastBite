"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  FileBarChart,
  Flag,
  LayoutDashboard,
  Package,
  Percent,
  Receipt,
  Store,
  Wallet,
} from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/dashboard/combos", label: "Combo", icon: Package },
  { href: "/dashboard/orders", label: "Đơn hàng", icon: Receipt },
  { href: "/dashboard/pricing", label: "Ưu đãi mua chung", icon: Percent },
  { href: "/dashboard/feedback", label: "Báo cáo từ khách", icon: Flag },
  { href: "/dashboard/store", label: "Thông tin cửa hàng", icon: Store },
  { href: "/dashboard/subscription", label: "Gói dịch vụ", icon: CreditCard },
  { href: "/dashboard/revenue", label: "Doanh thu & hoa hồng", icon: Wallet },
  { href: "/dashboard/reports", label: "Báo cáo tháng", icon: FileBarChart },
];

// Vertical, persistent-sidebar version of the store nav (see
// app/(store)/layout.tsx) — the "you're in a different mode now" signal for
// the store area, YouTube Studio-style. Same filled-pill active state as
// the header's site-menu.tsx dropdown for a consistent visual language
// between the two nav levels.
export function StoreSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row flex-wrap items-center gap-1 sm:flex-col sm:items-stretch">
      {/* The explicit "you're stuck here otherwise" exit, called out in
          user feedback — YouTube Studio's own header lets you click back to
          regular YouTube the same way. */}
      <Link
        href="/"
        className="mb-1 flex shrink-0 items-center gap-2.5 rounded-full border border-dashed px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary sm:mb-2"
      >
        <ArrowLeft className="size-4" />
        Về trang người dùng
      </Link>
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
