import { Suspense } from "react";
import { Leaf, Sprout, TreePine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { listCategories } from "@/lib/repositories/category.repository";
import { getTopPurchasedCategoryIds } from "@/lib/repositories/order.repository";
import { CategoryRail } from "@/app/(customer)/_components/category-rail";
import { ComboSections } from "@/app/(customer)/_components/combo-sections";
import { SearchResultsSection } from "@/app/(customer)/_components/search-results-section";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{
    categoryId?: string;
    q?: string;
    sort?: string;
    minPrice?: string;
    maxPrice?: string;
    radiusM?: string;
  }>;
}) {
  const { categoryId, q, sort, minPrice, maxPrice, radiusM } = await searchParams;
  const isFiltered = Boolean(q || sort || minPrice || maxPrice || radiusM);

  const supabase = await createClient();
  const [categories, userId] = await Promise.all([
    listCategories(supabase),
    getCurrentUserId(supabase),
  ]);
  const topCategoryIds = userId ? await getTopPurchasedCategoryIds(supabase, userId, 1) : [];
  const recommendedCategoryId = topCategoryIds[0];

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-primary to-emerald-700 px-6 py-14 text-center">
        {/* Decorative leaf/tree silhouettes — no external image asset,
            just low-opacity lucide icons scattered behind the text. */}
        <Leaf
          aria-hidden
          className="pointer-events-none absolute -left-8 -top-8 size-40 -rotate-12 text-white/10"
        />
        <Sprout
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[18%] size-24 text-white/10"
        />
        <TreePine
          aria-hidden
          className="pointer-events-none absolute -right-6 -bottom-8 size-44 rotate-6 text-white/10"
        />
        <Leaf
          aria-hidden
          className="pointer-events-none absolute right-[12%] top-2 size-16 rotate-45 text-white/10"
        />

        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
            <Leaf className="size-3.5" />
            Net Zero · Ăn ngon, giảm lãng phí
          </span>
          <h1 className="text-3xl font-bold text-white sm:text-4xl">
            Đồ ăn ngon cuối ngày, giá tốt hơn — ngay gần bạn
          </h1>
          <p className="text-white/90">
            Xem đúng món, đúng ảnh, đúng hạn dùng trước khi đặt. Không đoán mò, không rủi ro.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Khám phá theo loại combo</h2>
        <CategoryRail categories={categories} activeCategoryId={categoryId} />
      </section>

      {/* Search (site-search.tsx, header) or the filter icon (site-search-
          filters.tsx, header) switches this from the tabbed browse view to
          filtered search results — same URL-searchParams contract as
          categoryId above, just read server-side here to pick the view. */}
      {isFiltered ? (
        <section className="space-y-3">
          <Suspense>
            <SearchResultsSection />
          </Suspense>
        </section>
      ) : (
        <Suspense>
          <ComboSections recommendedCategoryId={recommendedCategoryId} />
        </Suspense>
      )}
    </div>
  );
}
