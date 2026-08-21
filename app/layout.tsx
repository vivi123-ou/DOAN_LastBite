import type { Metadata } from "next";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { RootChrome } from "@/components/layout/root-chrome";
import { CartProvider } from "@/lib/cart/cart-context";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/profile.repository";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Brand wordmark only ("LastBite" in the header + homepage hero) — a
// rounded, friendly display face distinct from the body's Geist, matching
// the casual food-tech-brand feel (Grab/Baemin-style) the user asked for.
// Not applied to body text anywhere — Fredoka has no Vietnamese subset, and
// every other string in this app is Vietnamese.
const fredoka = Fredoka({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700"],
});

export const metadata: Metadata = {
  title: "LastBite — Combo cuối ngày, giảm giá xanh",
  description:
    "LastBite kết nối bạn với các combo đồ ăn, thức uống cuối ngày còn ngon từ cửa hàng gần bạn — tiết kiệm chi phí, giảm lãng phí thực phẩm, hướng tới Net Zero.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Fetched once, here, and handed down to RootChrome as props — both
  // SiteHeader and AdminHeader used to each independently fetch this same
  // profile row (one extra redundant query per page load); now there's
  // exactly one. See root-chrome.tsx's own comment for why the actual
  // SiteHeader-vs-AdminHeader *switch* has to happen client-side
  // (usePathname()) rather than here in the root layout — a root layout
  // only re-runs on a hard reload, not on ordinary client-side navigation,
  // so branching on the path here silently kept the wrong header visible
  // after clicking into /admin from the customer site.
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub as string | undefined;
  const profile = userId ? await getById(supabase, userId) : null;
  const email = (data?.claims.email as string) ?? null;

  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full scroll-smooth antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        {/* CartProvider is a Client Component, but RootChrome (also client,
            for the reason above) can still be nested inside it normally. */}
        <CartProvider>
          <RootChrome
            userId={userId}
            role={profile?.role ?? null}
            fullName={profile?.fullName ?? null}
            avatarUrl={profile?.avatarUrl ?? null}
            email={email}
          >
            {children}
          </RootChrome>
          <Toaster />
        </CartProvider>
      </body>
    </html>
  );
}
