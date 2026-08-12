import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
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

export const metadata: Metadata = {
  title: "LastBite — Combo cuối ngày, giảm giá xanh",
  description:
    "LastBite kết nối bạn với các combo đồ ăn, thức uống cuối ngày còn ngon từ cửa hàng gần bạn — tiết kiệm chi phí, giảm lãng phí thực phẩm, hướng tới Net Zero.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full scroll-smooth antialiased`}
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
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
          <Toaster />
        </CartProvider>
      </body>
    </html>
  );
}
