"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

const SORT_OPTIONS = [
  { value: "relevance", label: "Liên quan nhất" },
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
];

const RADIUS_OPTIONS = [
  { value: "1000", label: "1 km" },
  { value: "3000", label: "3 km" },
  { value: "5000", label: "5 km" },
  { value: "10000", label: "10 km" },
];

// Shopee-style click-to-select bands instead of free-typed min/max — see
// the old app/(customer)/_components/filter-bar.tsx this replaces.
const PRICE_BANDS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "under-30k", label: "Dưới 30.000đ", max: 30_000 },
  { key: "30-60k", label: "30.000đ - 60.000đ", min: 30_000, max: 60_000 },
  { key: "60-100k", label: "60.000đ - 100.000đ", min: 60_000, max: 100_000 },
  { key: "100-200k", label: "100.000đ - 200.000đ", min: 100_000, max: 200_000 },
  { key: "over-200k", label: "Trên 200.000đ", min: 200_000 },
];

// "Gom tính năng lọc vào chỗ tìm kiếm, thành icon lọc" — sort/price/area
// used to be their own always-visible panel below the hero (filter-bar.tsx).
// Now it's a single icon next to the header search box (site-search.tsx),
// opening a small panel with khu vực/giá/sắp xếp — applies to whatever
// results are currently showing (search results if `q` is set, otherwise
// it activates search-results mode with just a filter and no query, same
// as nearby-combos-section.tsx's existing `isFiltered` switch).
export function SiteSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const sort = searchParams.get("sort") ?? "relevance";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const radiusM = searchParams.get("radiusM") ?? "5000";

  const activeBandKey = PRICE_BANDS.find(
    (band) => String(band.min ?? "") === minPrice && String(band.max ?? "") === maxPrice
  )?.key;
  const activeCount =
    (sort !== "relevance" ? 1 : 0) + (activeBandKey ? 1 : 0) + (radiusM !== "5000" ? 1 : 0);

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function pushParams(next: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, val] of Object.entries(next)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    router.push(`/?${params.toString()}`);
  }

  function togglePriceBand(band: (typeof PRICE_BANDS)[number]) {
    if (band.key === activeBandKey) {
      pushParams({ minPrice: undefined, maxPrice: undefined });
      return;
    }
    pushParams({
      minPrice: band.min ? String(band.min) : undefined,
      maxPrice: band.max ? String(band.max) : undefined,
    });
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`relative flex size-10 items-center justify-center rounded-md border transition-colors ${
          activeCount > 0 ? "border-primary text-primary" : "border-input text-muted-foreground hover:text-foreground"
        }`}
        aria-label="Bộ lọc tìm kiếm"
      >
        <SlidersHorizontal className="size-4" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-72 space-y-4 rounded-md border bg-popover p-4 shadow-lg">
          <div className="space-y-2">
            <p className="text-sm font-medium">Sắp xếp</p>
            <div className="flex flex-wrap gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pushParams({ sort: opt.value !== "relevance" ? opt.value : undefined })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    sort === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Khu vực</p>
            <div className="flex flex-wrap gap-1.5">
              {RADIUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => pushParams({ radiusM: opt.value !== "5000" ? opt.value : undefined })}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    radiusM === opt.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Khoảng giá</p>
            <div className="flex flex-wrap gap-1.5">
              {PRICE_BANDS.map((band) => (
                <button
                  key={band.key}
                  type="button"
                  onClick={() => togglePriceBand(band)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    band.key === activeBandKey
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
