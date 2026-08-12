"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, X } from "lucide-react";

const SORT_OPTIONS = [
  { value: "relevance", label: "Liên quan nhất" },
  { value: "newest", label: "Mới nhất" },
  { value: "price_asc", label: "Giá thấp đến cao" },
];

const RADIUS_OPTIONS = [
  { value: "1000", label: "1 km" },
  { value: "3000", label: "3 km" },
  { value: "5000", label: "5 km" },
  { value: "10000", label: "10 km" },
];

// Shopee-style click-to-select bands instead of free-typed min/max — see
// the old app/(customer)/_components/filter-bar.tsx this replaces. Full
// ladder up to "Trên 1.000.000đ" per explicit feedback that the original
// top band (200k+) didn't cover a wide enough range of denominations.
const PRICE_BANDS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "under-50k", label: "Dưới 50.000đ", max: 50_000 },
  { key: "50-100k", label: "50.000đ - 100.000đ", min: 50_000, max: 100_000 },
  { key: "100-200k", label: "100.000đ - 200.000đ", min: 100_000, max: 200_000 },
  { key: "200-500k", label: "200.000đ - 500.000đ", min: 200_000, max: 500_000 },
  { key: "500k-1m", label: "500.000đ - 1.000.000đ", min: 500_000, max: 1_000_000 },
  { key: "over-1m", label: "Trên 1.000.000đ", min: 1_000_000 },
];

// "Gom tính năng lọc vào chỗ tìm kiếm, thành icon lọc" — sort/price/area
// used to be their own always-visible panel below the hero (filter-bar.tsx).
// Now it's a single icon next to the header search box (site-search.tsx),
// opening a small panel with khu vực/giá/sắp xếp — applies to whatever
// results are currently showing (search results if `q` is set, otherwise
// it activates search-results mode with just a filter and no query, same
// as search-results-section.tsx's existing `isFiltered` switch).
//
// Every chip here is read from the URL with no "?? default" fallback —
// earlier versions treated the implicit default (radiusM absent = 5km) as
// visually "selected", which meant the 5km chip always showed green even
// when the user had never touched it, and clicking it again looked like a
// no-op ("bấm lại để hủy chọn cũng không được"). Now a chip is only ever
// green when its param is genuinely present in the URL, so every group
// (sort/radius/price) is independently optional — 0, 1, 2, or 3 active at
// once — and toggling the active chip in any group always clears it.
export function SiteSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const sort = searchParams.get("sort");
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";
  const radiusM = searchParams.get("radiusM");

  const activeBandKey = PRICE_BANDS.find(
    (band) => String(band.min ?? "") === minPrice && String(band.max ?? "") === maxPrice
  )?.key;
  const activeCount = (sort ? 1 : 0) + (activeBandKey ? 1 : 0) + (radiusM ? 1 : 0);

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

  function toggleSort(value: string) {
    pushParams({ sort: sort === value ? undefined : value });
  }

  function toggleRadius(value: string) {
    pushParams({ radiusM: radiusM === value ? undefined : value });
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

  function clearAll() {
    pushParams({ sort: undefined, radiusM: undefined, minPrice: undefined, maxPrice: undefined });
    setOpen(false);
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
        <div className="absolute right-0 top-full z-50 mt-1 w-72 rounded-md border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">Bộ lọc</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Đóng"
              className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Sắp xếp</p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggleSort(opt.value)}
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
                    onClick={() => toggleRadius(opt.value)}
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

            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="w-full rounded-md border border-dashed py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                Xoá bộ lọc
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
