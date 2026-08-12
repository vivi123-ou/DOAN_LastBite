"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Info, Menu, MapPin, Receipt, Store } from "lucide-react";

interface SiteMenuProps {
  role: "customer" | "store_owner" | null;
  isLoggedIn: boolean;
}

interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
}

// inbook.vn's own "MENU" hamburger — collapsed by default so scrolling only
// ever shows the sticky header (per explicit feedback: a persistent side
// rail eating vertical space next to content wasn't wanted, an overlay
// dropdown you open on demand was). Replaces the previous always-visible
// a persistent left rail. "Cửa hàng của tôi" is
// shown to *any* logged-in account, not just store_owner — /dashboard
// already branches to the registration form for accounts with no store yet
// (app/(store)/dashboard/page.tsx).
export function SiteMenu({ role, isLoggedIn }: SiteMenuProps) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

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
  if (isLoggedIn && role !== "store_owner") {
    primaryItems.push({ href: "/orders", label: "Đơn hàng của tôi", icon: Receipt });
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
      >
        <Menu className="size-5" />
        <span className="hidden md:inline">Menu</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 space-y-1 rounded-md border bg-popover p-2 shadow-lg">
          {primaryItems.map(renderItem)}

          {isLoggedIn && (
            <>
              <div className="my-1 border-t" />
              {renderItem({ href: "/dashboard", label: "Cửa hàng của tôi", icon: Store })}
            </>
          )}

          <div className="my-1 border-t" />
          {renderItem({ href: "/#site-footer", label: "Về chúng tôi", icon: Info })}
        </div>
      )}
    </div>
  );
}
