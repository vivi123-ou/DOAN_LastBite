"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CreditCard,
  LayoutDashboard,
  Store,
  Package,
  Flag,
  ClipboardList,
  Megaphone,
  Users,
  Percent,
  Wallet,
} from "lucide-react";

// `countKey` maps a nav item to the matching field on AdminSidebarCounts —
// only "Cửa hàng" (pending approvals) and "Báo cáo" (open reports) get a
// badge, the two counts an admin actually needs a quick heads-up on
// without opening the page first.
const ITEMS = [
  { href: "/admin", label: "Tổng quan", icon: LayoutDashboard, countKey: null },
  { href: "/admin/stores", label: "Cửa hàng", icon: Store, countKey: "pendingStores" as const },
  { href: "/admin/combos", label: "Combo", icon: Package, countKey: null },
  { href: "/admin/plans", label: "Gói dịch vụ", icon: CreditCard, countKey: null },
  { href: "/admin/subscriptions", label: "Đăng ký gói", icon: ClipboardList, countKey: null },
  { href: "/admin/commission", label: "Hoa hồng", icon: Percent, countKey: null },
  { href: "/admin/payouts", label: "Đối soát", icon: Wallet, countKey: null },
  { href: "/admin/ads", label: "Quảng cáo", icon: Megaphone, countKey: null },
  { href: "/admin/reports", label: "Báo cáo", icon: Flag, countKey: "openReports" as const },
  { href: "/admin/users", label: "Người dùng", icon: Users, countKey: null },
];

interface AdminSidebarProps {
  // Fetched once in app/(admin)/admin/layout.tsx (a Server Component) and
  // passed down — this component is itself a Client Component
  // (usePathname() for the active-route highlight), so it can't fetch its
  // own data.
  counts: { pendingStores: number; openReports: number };
}

// Same persistent-sidebar shape as StoreSidebar (app/(store)/_components/store-sidebar.tsx)
// — one more "you're in a different mode now" area, consistent visual
// language with the store dashboard's own Studio-style split.
export function AdminSidebar({ counts }: AdminSidebarProps) {
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
      {ITEMS.map(({ href, label, icon: Icon, countKey }) => {
        const isActive = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
        const count = countKey ? counts[countKey] : 0;
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
            {count > 0 && (
              <span
                className={`ml-auto flex size-5 items-center justify-center rounded-full text-xs font-semibold ${
                  isActive ? "bg-primary-foreground/20" : "bg-destructive text-destructive-foreground"
                }`}
              >
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
