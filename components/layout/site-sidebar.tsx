"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MapPin, Receipt, Store, Info } from "lucide-react";

interface SiteSidebarProps {
  role: "customer" | "store_owner" | null;
  isLoggedIn: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

// Vertical, YouTube-regular-sidebar-style version of what used to be
// main-nav.tsx's horizontal pills — "Trang chủ"/"Bản đồ"/"Đơn hàng của tôi"
// move here; "Cửa hàng của tôi" gets its own section below a divider, same
// "you" vs "your channel" split YouTube uses, and is shown to *any*
// logged-in account (not just store_owner) since /dashboard itself already
// branches to the registration form for accounts with no store yet — see
// app/(store)/dashboard/page.tsx. Same filled-pill active state as the
// store-area sidebar (app/(store)/_components/store-sidebar.tsx) for a
// consistent visual language between the two nav levels.
export function SiteSidebar({ role, isLoggedIn }: SiteSidebarProps) {
  const pathname = usePathname();

  const primaryItems: NavItem[] = [
    { href: "/", label: "Trang chủ", icon: Home },
    { href: "/map", label: "Bản đồ", icon: MapPin },
  ];
  if (isLoggedIn && role !== "store_owner") {
    primaryItems.push({ href: "/orders", label: "Đơn hàng của tôi", icon: Receipt });
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  function renderItem({ href, label, icon: Icon }: NavItem) {
    const active = isActive(href);
    return (
      <Link
        key={href}
        href={href}
        className={`flex shrink-0 items-center gap-2.5 rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
          active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Icon className="size-4" />
        {label}
      </Link>
    );
  }

  return (
    <nav className="flex flex-row flex-wrap gap-1 sm:flex-col">
      {primaryItems.map(renderItem)}

      {isLoggedIn && (
        <>
          <div className="my-1 hidden border-t sm:block" />
          {renderItem({ href: "/dashboard", label: "Cửa hàng của tôi", icon: Store })}
        </>
      )}

      <div className="my-1 hidden border-t sm:block" />
      {renderItem({ href: "/#site-footer", label: "Về chúng tôi", icon: Info })}
    </nav>
  );
}
