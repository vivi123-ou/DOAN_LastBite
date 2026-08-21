import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono, Fredoka } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { AdminHeader } from "@/components/layout/admin-header";
import { CartProvider } from "@/lib/cart/cart-context";
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
  // x-pathname is set by proxy.ts on every request — the standard Next.js
  // way to hand a Server Component layout the current path, since there's
  // no server-side usePathname(). Used here for exactly one purpose: /admin
  // gets a completely separate "back office" chrome (AdminHeader, no
  // SiteFooter) instead of the customer storefront's cart/search/nav —
  // explicit request, not a variant of the same header.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isAdmin = pathname.startsWith("/admin");

  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${fredoka.variable} h-full scroll-smooth antialiased`}
    >
      <body
        className="min-h-full flex flex-col bg-background text-foreground"
        suppressHydrationWarning
      >
        {/* CartProvider is a Client Component, but SiteHeader/SiteFooter
            (Server Components) can still be passed into it as children —
            Next.js renders the server subtree first and hands it down
            opaquely. SiteFooter carries id="site-footer", the scroll target
            for every "Về chúng tôi" menu link (site-menu.tsx). */}
        <CartProvider>
          {isAdmin ? <AdminHeader /> : <SiteHeader />}
          <main className="flex-1">{children}</main>
          {!isAdmin && <SiteFooter />}
          <Toaster />
        </CartProvider>
      </body>
    </html>
  );
}
