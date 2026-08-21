import Link from "next/link";
import { ArrowLeft, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/profile.repository";
import { UserMenu } from "@/components/layout/user-menu";

// Deliberately separate from SiteHeader, not a variant of it — explicit
// request: /admin should read as "back office" (no cart/search/shopping
// chrome at all), not the customer storefront with an extra sidebar bolted
// on underneath. Same h-16 height as SiteHeader so app/(admin)/admin/layout.tsx's
// `sticky top-16` sidebar math (copied from the store dashboard's own
// StoreSidebar) still lines up correctly.
export async function AdminHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;
  const profile = userId ? await getById(supabase, userId) : null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/admin" className="flex shrink-0 items-center gap-2 font-display text-lg font-semibold text-primary">
          <Shield className="size-6" />
          LastBite Admin
        </Link>

        <div className="flex-1" />

        <Link
          href="/"
          className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Về trang chính
        </Link>

        {userId && profile && (
          <UserMenu
            fullName={profile.fullName}
            avatarUrl={profile.avatarUrl}
            email={(data?.claims.email as string) ?? null}
          />
        )}
      </div>
    </header>
  );
}
