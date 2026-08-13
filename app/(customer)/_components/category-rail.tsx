import Link from "next/link";
import {
  CakeSlice,
  Coffee,
  CupSoda,
  Flame,
  LayoutGrid,
  Popcorn,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import type { Category } from "@/lib/domain/category";

// Icon per category slug — matches lib/domain/category.ts's
// ALLOWED_CATEGORY_SLUGS. Falls back to UtensilsCrossed for any future
// category added without an icon mapped here yet, rather than crashing.
const ICON_BY_SLUG: Record<string, LucideIcon> = {
  "tra-sua-nuoc-uong": CupSoda,
  "ca-phe": Coffee,
  "banh-ngot-trang-mieng": CakeSlice,
  "do-nuong": Flame,
  "com-do-an-chin": UtensilsCrossed,
  "do-an-vat": Popcorn,
};

// Icon + label tiles in a centered grid — modeled on the inBook.vn
// "Explore by interest" reference the user gave, replacing the old
// Shopee-pill-style rail (a plain row of rounded-full text buttons) per
// explicit request. Still the exact same href contract (`/` for "Tất cả",
// `/?categoryId=` per category) that page.tsx/CategoryRail always used, so
// nothing downstream needed to change.
export function CategoryRail({
  categories,
  activeCategoryId,
}: {
  categories: Category[];
  activeCategoryId?: string;
}) {
  return (
    <div className="mx-auto grid max-w-4xl grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-7">
      <CategoryTile href="/" label="Tất cả" Icon={LayoutGrid} active={!activeCategoryId} />
      {categories.map((category) => (
        <CategoryTile
          key={category.id}
          href={`/?categoryId=${category.id}`}
          label={category.name}
          Icon={ICON_BY_SLUG[category.slug] ?? UtensilsCrossed}
          active={activeCategoryId === category.id}
        />
      ))}
    </div>
  );
}

function CategoryTile({
  href,
  label,
  Icon,
  active,
}: {
  href: string;
  label: string;
  Icon: LucideIcon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-colors ${
        active ? "border-primary bg-primary/5" : "border-border hover:border-primary hover:bg-muted/40"
      }`}
    >
      <span
        className={`flex size-12 items-center justify-center rounded-full ${
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        <Icon className="size-6" />
      </span>
      <span className={`text-sm font-medium ${active ? "text-primary" : "text-foreground"}`}>
        {label}
      </span>
    </Link>
  );
}
