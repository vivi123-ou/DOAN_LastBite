"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Info, Menu, MapPin, Receipt, Store, Users } from "lucide-react";

interface SiteMenuProps {
  role: "customer" | "store_owner" | null;
  isLoggedIn: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

// A left-edge slide-in drawer (not an anchored dropdown) — open by default
// on first load so the nav is discoverable immediately, closes on scroll-
// down (the sticky header stays put; only the drawer hides), and can always
// be reopened via the hamburger button. "Cửa hàng của tôi" is shown to
// *any* logged-in account, not just store_owner — /dashboard already
// branches to the registration form for accounts with no store yet
// (app/(store)/dashboard/page.tsx).
export function SiteMenu({ role, isLoggedIn }: SiteMenuProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let lastY = window.scrollY;
    function handleScroll() {
      const y = window.scrollY;
      // Only react to a real downward scroll past the header's own height —
      // ignores the tiny jitter some trackpads/mobile browsers report.
      if (y > lastY && y > 80) setOpen(false);
      lastY = y;
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const primaryItems: NavItem[] = [
    { href: "/", label: "Trang chủ", icon: Home },
    { href: "/map", label: "Bản đồ", icon: MapPin },
  ];
  if (isLoggedIn) {
    primaryItems.push({ href: "/friends", label: "Bạn bè", icon: Users });
    if (role !== "store_owner") {
      primaryItems.push({ href: "/orders", label: "Đơn hàng của tôi", icon: Receipt });
    }
  }

  function renderItem({ href, label, icon: Icon }: NavItem) {
    const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
        }`}
      >
        <Icon className="size-4" />
        {label}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex shrink-0 items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Menu"
        aria-expanded={open}
      >
        <Menu className="size-5" />
        <span className="hidden md:inline">Menu</span>
      </button>

      {/* Backdrop — click-outside-to-close, sits below the h-16 header. */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`fixed inset-x-0 top-16 bottom-0 z-40 bg-black/30 transition-opacity duration-300 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Always mounted (not conditionally rendered) so the transform
          transition actually animates in/out instead of popping. */}
      <nav
        className={`fixed left-0 top-16 bottom-0 z-40 w-72 space-y-1 overflow-y-auto border-r bg-background p-3 shadow-lg transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {primaryItems.map(renderItem)}

        {isLoggedIn && (
          <>
            <div className="my-1 border-t" />
            {renderItem({ href: "/dashboard", label: "Cửa hàng của tôi", icon: Store })}
          </>
        )}

        <div className="my-1 border-t" />
        {renderItem({ href: "/#site-footer", label: "Về chúng tôi", icon: Info })}
      </nav>
    </>
  );
}
