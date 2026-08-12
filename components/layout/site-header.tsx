import Link from "next/link";
import { Leaf } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { CartBadge } from "@/components/layout/cart-badge";
import { MainNav } from "@/components/layout/main-nav";
import { signOut } from "@/app/(auth)/actions";

export async function SiteHeader() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;

  let role: "customer" | "store_owner" | null = null;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    role = profile?.role ?? null;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-primary">
          <Leaf className="size-6" />
          LastBite
        </Link>

        <MainNav role={role} isLoggedIn={Boolean(userId)} />

        <div className="flex items-center gap-2">
          {role !== "store_owner" && <CartBadge />}
          {userId ? (
            <>
              {role !== "store_owner" && (
                <Button
                  variant="ghost"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/dashboard">Kênh cửa hàng</Link>}
                />
              )}
              <form action={signOut}>
                <Button variant="outline" size="sm" type="submit">
                  Đăng xuất
                </Button>
              </form>
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
