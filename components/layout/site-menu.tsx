"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Info, Menu, MapPin, Receipt, Shield, Store, Users } from "lucide-react";

interface SiteMenuProps {
  role: "customer" | "store_owner" | "admin" | null;
  isLoggedIn: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

// An anchored dropdown (not a fixed full-height drawer — that version had
// a layout bug and was reverted per explicit feedback) with a fade + scale
// transition. Still opens by default on first load so the nav is
// discoverable immediately, and still closes on scroll-down (the sticky
// header stays put; only the panel hides) — those two behaviors were
// explicitly asked for and kept, only the *shape* of the menu changed.
// "Cửa hàng của tôi" is shown to *any* logged-in account, not just
// store_owner — /dashboard already branches to the registration form for
// accounts with no store yet (app/(store)/dashboard/page.tsx).
export function SiteMenu({ role, isLoggedIn }: SiteMenuProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
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
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label="Menu"
        aria-expanded={open}
      >
        <Menu className="size-5" />
        <span className="hidden md:inline">Menu</span>
      </button>

      {/* Always mounted (not conditionally rendered) so the fade+scale
          transition actually animates instead of popping in/out. */}
      <nav
        className={`absolute left-0 top-full z-50 mt-2 w-64 origin-top-left space-y-1 rounded-md border bg-popover p-2 shadow-lg transition-all duration-200 ease-out ${
          open ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none -translate-y-1 scale-95 opacity-0"
        }`}
      >
        {primaryItems.map(renderItem)}

        {isLoggedIn && (
          <>
            <div className="my-1 border-t" />
            {renderItem({ href: "/dashboard", label: "Cửa hàng của tôi", icon: Store })}
          </>
        )}

        {role === "admin" && (
          <>
            <div className="my-1 border-t" />
            {renderItem({ href: "/admin", label: "Quản trị", icon: Shield })}
          </>
        )}

        <div className="my-1 border-t" />
        {renderItem({ href: "/#site-footer", label: "Về chúng tôi", icon: Info })}
      </nav>
    </div>
  );
}
