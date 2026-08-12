import Link from "next/link";
import { Leaf } from "lucide-react";

// lucide-react dropped its brand/logo icon set — these are small inline
// glyphs (currentColor, same 24x24 viewBox convention as lucide) so the
// social row still reads as recognizable brand marks instead of a generic
// placeholder icon.
function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M14 13.5h2.5l1-4H14v-2c0-1.03 0-2 2-2h1.5V2.14C17.17 2.1 15.95 2 14.66 2 11.98 2 10 3.66 10 6.7v2.8H7v4h3V22h4v-8.5Z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YoutubeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M22 8.2s-.2-1.55-.83-2.23c-.8-.86-1.68-.87-2.09-.92C16.2 4.8 12 4.8 12 4.8h-.01s-4.2 0-7.08.25c-.41.05-1.3.06-2.1.92C2.19 6.65 2 8.2 2 8.2S1.8 10 1.8 11.8v1.4c0 1.8.2 3.6.2 3.6s.2 1.55.82 2.23c.8.86 1.85.83 2.32.92 1.68.17 7.13.25 7.13.25s4.2-.01 7.08-.26c.41-.05 1.3-.06 2.09-.92.63-.68.83-2.23.83-2.23s.2-1.8.2-3.6v-1.4c0-1.8-.2-3.6-.2-3.6ZM9.94 15V8.6l5.5 3.2-5.5 3.2Z" />
    </svg>
  );
}

// Same column rhythm as the inbook.vn reference (.claude/rules/workflow.md):
// about blurb + socials, quick links, support/policy list, bottom bar. This
// is a capstone project, not a registered business, so — unlike inBook's
// footer — there's no business-registration-certificate block. Policy items
// are plain text, not links, since no such pages exist yet; adding dead
// links would be worse than an honest placeholder list.
const QUICK_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/map", label: "Bản đồ cửa hàng" },
  { href: "/dashboard", label: "Đăng ký cửa hàng" },
];

const SUPPORT_ITEMS = [
  "Câu hỏi thường gặp",
  "Chính sách bảo mật",
  "Điều khoản sử dụng",
];

// Facebook/Instagram are placeholders (href="#") — the user hasn't created
// those pages yet, this just reserves the visual slot. YouTube is real.
const SOCIAL_LINKS = [
  { href: "#", label: "Facebook", icon: FacebookIcon },
  { href: "#", label: "Instagram", icon: InstagramIcon },
  { href: "https://www.youtube.com/@LastBite-OU", label: "YouTube", icon: YoutubeIcon },
];

export function SiteFooter() {
  return (
    <footer id="site-footer" className="border-t bg-muted/30">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="space-y-3">
          <div className="flex items-center gap-2 font-bold text-lg text-primary">
            <Leaf className="size-6" />
            LastBite
          </div>
          <p className="text-sm text-muted-foreground">
            Kết nối bạn với combo đồ ăn, thức uống cuối ngày còn ngon từ cửa hàng gần bạn — tiết
            kiệm chi phí, giảm lãng phí thực phẩm, hướng tới Net Zero.
          </p>
          <div className="flex items-center gap-2 pt-1">
            {SOCIAL_LINKS.map(({ href, label, icon: Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                className="flex size-9 items-center justify-center rounded-full border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Khám phá</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-primary">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Hỗ trợ</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {SUPPORT_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t px-4 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} LastBite — Đồ án tốt nghiệp, Trường Đại học Mở TP.HCM (OU).
      </div>
    </footer>
  );
}
