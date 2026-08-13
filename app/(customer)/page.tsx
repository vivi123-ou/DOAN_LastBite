import { Suspense } from "react";
import { Leaf, Sprout, TreePine } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { listCategories } from "@/lib/repositories/category.repository";
import { getTopPurchasedCategoryIds } from "@/lib/repositories/order.repository";
import { getStoreByOwnerId } from "@/lib/repositories/store.repository";
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
  // A specific category pill also switches to the filtered results view —
  // explicit feedback: browsing one category should be a single newest-
  // sorted list, not the "Tất cả" multi-row layout repeated for just that
  // category (search-results-section.tsx defaults sort to "newest" when
  // categoryId is set with no explicit sort chosen).
  const isFiltered = Boolean(q || sort || minPrice || maxPrice || radiusM || categoryId);

  const supabase = await createClient();
  const [categories, userId] = await Promise.all([
    listCategories(supabase),
    getCurrentUserId(supabase),
  ]);
  const topCategoryIds = userId ? await getTopPurchasedCategoryIds(supabase, userId, 1) : [];
  const recommendedCategoryId = topCategoryIds[0];
  const categoryName = categoryId ? categories.find((c) => c.id === categoryId)?.name : undefined;
  // Gates "Thêm vào giỏ hàng" on every card grid for the viewer's own
  // combos (add-to-cart-button.tsx's isOwnStore prop) — combos/[id]/page.tsx
  // already hides the button entirely for its own store, but the flat
  // card grids (carousels, search results) had no equivalent check and
  // were silently letting a store owner add their own combo to their own
  // cart. undefined for guests/customers with no store — never matches any
  // real combo.storeId, so the check is simply always false for them.
  const viewerStore = userId ? await getStoreByOwnerId(supabase, userId) : null;
  const viewerStoreId = viewerStore?.id;

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
        <h2 className="text-xl font-bold sm:text-2xl">Khám phá theo loại combo</h2>
        <CategoryRail categories={categories} activeCategoryId={categoryId} />
      </section>

      {/* Search (site-search.tsx, header), the filter icon (site-search-
          filters.tsx, header), or a category pill above all switch this
          from the "Tất cả" browse view to filtered search results. */}
      {isFiltered ? (
        <Suspense>
          <SearchResultsSection categoryName={categoryName} viewerStoreId={viewerStoreId} />
        </Suspense>
      ) : (
        <Suspense>
          <ComboSections
            recommendedCategoryId={recommendedCategoryId}
            categories={categories}
            viewerStoreId={viewerStoreId}
          />
        </Suspense>
      )}
    </div>
  );
}
