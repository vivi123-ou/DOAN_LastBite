import { Suspense } from "react";
import { Leaf } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/repositories/category.repository";
import { CategoryRail } from "@/app/(customer)/_components/category-rail";
import { NearbyCombosSection } from "@/app/(customer)/_components/nearby-combos-section";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ categoryId?: string }>;
}) {
  const { categoryId } = await searchParams;
  const supabase = await createClient();
  const categories = await listCategories(supabase);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <section className="rounded-2xl bg-primary/10 px-6 py-12 text-center">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
          <span className="flex items-center gap-2 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            <Leaf className="size-3.5" />
            Net Zero · Ăn ngon, giảm lãng phí
          </span>
          <h1 className="text-3xl font-bold sm:text-4xl">
            Đồ ăn ngon cuối ngày, giá tốt hơn — ngay gần bạn
          </h1>
          <p className="text-muted-foreground">
            Xem đúng món, đúng ảnh, đúng hạn dùng trước khi đặt. Không đoán mò, không rủi ro.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Khám phá theo loại combo</h2>
        <CategoryRail categories={categories} activeCategoryId={categoryId} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Combo gần bạn</h2>
        <Suspense>
          <NearbyCombosSection />
        </Suspense>
      </section>
    </div>
  );
}
