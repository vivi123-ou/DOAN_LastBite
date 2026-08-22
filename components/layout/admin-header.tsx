import Link from "next/link";
import { Shield } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";

interface AdminHeaderProps {
  userId?: string;
  fullName: string | null;
  avatarUrl: string | null;
  email: string | null;
}

// Deliberately separate from SiteHeader, not a variant of it — explicit
// request: /admin should read as "back office" (no cart/search/shopping
// chrome at all), not the customer storefront with an extra sidebar bolted
// on underneath. Same h-16 height as SiteHeader so app/(admin)/admin/layout.tsx's
// `sticky top-16` sidebar math (copied from the store dashboard's own
// StoreSidebar) still lines up correctly.
//
// Plain prop-driven function, not its own async Server Component fetch —
// see site-header.tsx's own comment for why (root-chrome.tsx needs both
// headers pre-rendered with data already resolved, so it can switch between
// them purely client-side on every navigation, not just on a hard reload).
export function AdminHeader({ userId, fullName, avatarUrl, email }: AdminHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link
          href="/admin"
          className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold text-primary"
        >
          <Shield className="size-6" />
          LastBite Admin
        </Link>

        <div className="flex-1" />

        {/* No "Về trang chính" link here — AdminSidebar already has one
            ("Về trang người dùng", top of the left nav), and having the
            same exit in two places at once just reads as clutter/a bug.
            One exit point, in the sidebar, is enough. */}
        {userId && <UserMenu fullName={fullName} avatarUrl={avatarUrl} email={email} />}
      </div>
    </header>
  );
}
