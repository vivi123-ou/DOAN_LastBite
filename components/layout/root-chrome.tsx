"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/layout/site-header";
import { AdminHeader } from "@/components/layout/admin-header";
import { SiteFooter } from "@/components/layout/site-footer";

interface RootChromeProps {
  userId?: string;
  role: "customer" | "store_owner" | "admin" | null;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
  children: ReactNode;
}

// Fixes a real bug: app/layout.tsx used to read the current path from
// headers() (set by proxy.ts) and pick SiteHeader vs AdminHeader once, at
// render time — but the *root* layout only re-runs on a hard
// reload/router.refresh(), not on an ordinary client-side <Link>
// navigation (Next.js keeps a shared root layout mounted across
// navigations that stay under it, which is everything in this app). So
// clicking "Quản trị" from the homepage kept showing the customer
// SiteHeader — only typing the /admin URL directly (or refreshing) ever
// actually showed AdminHeader. usePathname() here is reactive to every
// client-side navigation, so the switch now happens correctly regardless
// of how the user got to /admin.
//
// userId/role/profile fields are fetched exactly once, in the root layout
// (app/layout.tsx) — passed down as props instead of each header doing its
// own redundant fetch (the previous two-Server-Components version each
// queried `profiles` independently). This component just decides which
// pre-built header to show; it does no data fetching of its own.
export function RootChrome({ userId, role, fullName, avatarUrl, email, children }: RootChromeProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname?.startsWith("/admin") ?? false;

  return (
    <>
      {isAdminRoute ? (
        <AdminHeader userId={userId} fullName={fullName} avatarUrl={avatarUrl} email={email} />
      ) : (
        <SiteHeader userId={userId} role={role} fullName={fullName} avatarUrl={avatarUrl} email={email} />
      )}
      <main className="flex-1">{children}</main>
      {!isAdminRoute && <SiteFooter />}
    </>
  );
}
