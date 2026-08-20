import Link from "next/link";
import { Leaf, PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/profile.repository";
import { Button } from "@/components/ui/button";
import { MiniCart } from "@/components/cart/mini-cart";
import { NotificationBell } from "@/components/layout/notification-bell";
import { SiteMenu } from "@/components/layout/site-menu";
import { SiteSearch } from "@/components/layout/site-search";
import { SiteSearchFilters } from "@/components/layout/site-search-filters";
import { UserMenu } from "@/components/layout/user-menu";

// inbook.vn's exact header shape: hamburger MENU, logo, search bar
// (centered/flexed), account actions. Nav that used to be a persistent left
// sidebar is now an on-demand dropdown
// (site-menu.tsx) — scrolling only ever shows this one sticky header, per
// explicit feedback that a permanent side rail felt heavier than intended.
export async function SiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;

  const profile = userId ? await getById(supabase, userId) : null;
  const role = profile?.role ?? null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-4">
        <SiteMenu role={role} isLoggedIn={Boolean(userId)} />

        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-bold text-lg text-primary"
        >
          <Leaf className="size-6" />
          <span className="hidden sm:inline">LastBite</span>
        </Link>

        <div className="mx-auto flex w-full max-w-xl min-w-0 flex-1 items-center gap-2">
          <SiteSearch />
          <SiteSearchFilters />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {/* Shown regardless of role — a store_owner account can still
              browse/buy from *other* stores as a customer (see the
              isOwnStore gate on combos/[id]/page.tsx, which only blocks
              buying from your own store, not shopping generally), so hiding
              the cart entirely for that role was hiding a feature that
              genuinely works. */}
          <MiniCart />
          {userId && profile ? (
            <>
              {/* "Kiểm tra đơn hàng" — inbook.vn reference has this as a
                  standalone header link straight to order tracking. /orders
                  already exists (phase 2) and already shows status per
                  order; this was just missing a direct entry point from the
                  header, so people had to go through Menu → "Đơn hàng của
                  tôi" instead. */}
              <Link
                href="/orders"
                aria-label="Kiểm tra đơn hàng"
                title="Kiểm tra đơn hàng"
                className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <PackageSearch className="size-5" />
              </Link>
              <NotificationBell userId={userId} />
              <UserMenu
                fullName={profile.fullName}
                avatarUrl={profile.avatarUrl}
                email={(data?.claims.email as string) ?? null}
              />
            </>
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
