"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf, Receipt, Star, User } from "lucide-react";

// "Lịch sử đơn hàng" points at the existing /orders page rather than a
// duplicate list nested under /account — that page already works end to
// end (phase 2), no reason to rebuild it just to fit under this sidebar.
// Same filled-pill active state as store-sidebar.tsx for a consistent
// visual language between the two sidebar levels this app now has.
const ITEMS = [
  { href: "/account", label: "Thông tin tài khoản", icon: User, exact: true },
  { href: "/orders", label: "Lịch sử đơn hàng", icon: Receipt, exact: false },
  { href: "/account/net-zero", label: "Điểm Net Zero", icon: Leaf, exact: false },
  { href: "/account/reviews", label: "Đánh giá đơn hàng", icon: Star, exact: false },
];

export function AccountSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-row flex-wrap gap-1 sm:flex-col sm:items-stretch">
      {ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const isActive = exact ? pathname === href : pathname.startsWith(href);
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
