"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Receipt, Store } from "lucide-react";

interface MainNavProps {
  role: "customer" | "store_owner" | null;
  isLoggedIn: boolean;
}

// Plain links get a filled pill when active (matches the same active-state
// pattern used for category pills on the homepage — see
// app/(customer)/_components/category-rail.tsx). "Cửa hàng của tôi" always
// gets the bordered pill treatment (not just when active) so it reads as a
// mode switch rather than just another page — same idea as YouTube's
// "Studio" button standing apart from its regular nav.
function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1.5 transition-colors ${
        active ? "bg-primary text-primary-foreground" : "hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}

export function MainNav({ role, isLoggedIn }: MainNavProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isMap = pathname.startsWith("/map");
  const isStoreArea = pathname.startsWith("/dashboard");
  const isOrders = pathname.startsWith("/orders");

  return (
    <nav className="hidden items-center gap-1 text-sm font-medium sm:flex">
      <NavLink href="/" active={isHome}>
        Trang chủ
      </NavLink>
      <NavLink href="/map" active={isMap}>
        <span className="flex items-center gap-1">
          <MapPin className="size-4" />
          Bản đồ
        </span>
      </NavLink>

      {role === "store_owner" ? (
        <Link
          href="/dashboard"
          className={`ml-1 flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${
            isStoreArea
              ? "border-primary bg-primary text-primary-foreground"
              : "border-primary/40 text-primary hover:bg-primary/10"
          }`}
        >
          <Store className="size-4" />
          Cửa hàng của tôi
        </Link>
      ) : (
        isLoggedIn && (
          <NavLink href="/orders" active={isOrders}>
            <span className="flex items-center gap-1">
              <Receipt className="size-4" />
              Đơn hàng của tôi
            </span>
          </NavLink>
        )
      )}
    </nav>
  );
}
