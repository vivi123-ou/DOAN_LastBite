import Link from "next/link";
import { Leaf } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/profile.repository";
import { Button } from "@/components/ui/button";
import { CartBadge } from "@/components/layout/cart-badge";
import { SiteSearch } from "@/components/layout/site-search";
import { UserMenu } from "@/components/layout/user-menu";

// Logo + search take the inbook.vn header shape: logo left, search bar
// centered/flexed between logo and account actions. The old horizontal nav
// (Trang chủ/Bản đồ/...) moved out of the header entirely — see
// site-sidebar.tsx, rendered by the (customer) route group's layout as a
// YouTube-style left rail instead.
export async function SiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;

  const profile = userId ? await getById(supabase, userId) : null;
  const role = profile?.role ?? null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-bold text-lg text-primary"
        >
          <Leaf className="size-6" />
          <span className="hidden sm:inline">LastBite</span>
        </Link>

        <div className="mx-auto flex w-full max-w-xl min-w-0 flex-1">
          <SiteSearch />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {role !== "store_owner" && <CartBadge />}
          {userId && profile ? (
            <UserMenu
              fullName={profile.fullName}
              avatarUrl={profile.avatarUrl}
              email={(data?.claims.email as string) ?? null}
            />
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/login">Đăng nhập</Link>}
              />
              <Button size="sm" nativeButton={false} render={<Link href="/signup">Đăng ký</Link>} />
            </>
          )}
        </div>
      </div>
    </header>
  );
}
