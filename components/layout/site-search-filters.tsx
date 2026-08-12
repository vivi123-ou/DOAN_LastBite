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

function bandKeyFor(minPrice: string, maxPrice: string): string | undefined {
  return PRICE_BANDS.find(
    (band) => String(band.min ?? "") === minPrice && String(band.max ?? "") === maxPrice
  )?.key;
}

// "Gom tính năng lọc vào chỗ tìm kiếm, thành icon lọc" — sort/price/area
// used to be their own always-visible panel below the hero (filter-bar.tsx).
// Now it's a single icon next to the header search box (site-search.tsx),
// opening a small panel with khu vực/giá/sắp xếp — applies to whatever
// results are currently showing (search results if `q` is set, otherwise
// it activates search-results mode with just a filter and no query, same
// as search-results-section.tsx's existing `isFiltered` switch).
//
// Chip clicks only edit *local draft state* now — nothing is pushed to the
// URL (and no search fires) until "Áp dụng" is pressed. Earlier versions
// pushed on every click, which searched on every single tap instead of
// once the user was actually done choosing (explicit feedback). The panel
// badge count still reflects the *applied* filters (read from the URL),
// not the draft, so fiddling with chips before applying doesn't move it.
export function SiteSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  const appliedSort = searchParams.get("sort");
  const appliedMinPrice = searchParams.get("minPrice") ?? "";
  const appliedMaxPrice = searchParams.get("maxPrice") ?? "";
  const appliedRadius = searchParams.get("radiusM");
  const appliedBandKey = bandKeyFor(appliedMinPrice, appliedMaxPrice);
  const activeCount = (appliedSort ? 1 : 0) + (appliedBandKey ? 1 : 0) + (appliedRadius ? 1 : 0);

  const [draftSort, setDraftSort] = useState(appliedSort);
  const [draftRadius, setDraftRadius] = useState(appliedRadius);
  const [draftBandKey, setDraftBandKey] = useState(appliedBandKey);

  // Re-sync the draft from whatever's actually applied at the moment the
  // panel is opened (a genuine user-initiated event, not an effect) — so
  // reopening later shows current reality, and any un-applied tinkering
  // from a previous open (closed via the X / outside click instead of
  // "Áp dụng") is discarded rather than lingering.
  function openPanel() {
    setDraftSort(appliedSort);
    setDraftRadius(appliedRadius);
    setDraftBandKey(appliedBandKey);
    setOpen(true);
  }

  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function applyFilters() {
    const band = PRICE_BANDS.find((b) => b.key === draftBandKey);
    const params = new URLSearchParams(searchParams.toString());
    const next: Record<string, string | undefined> = {
      sort: draftSort ?? undefined,
      radiusM: draftRadius ?? undefined,
      minPrice: band?.min ? String(band.min) : undefined,
      maxPrice: band?.max ? String(band.max) : undefined,
    };
    for (const [key, val] of Object.entries(next)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    router.push(`/?${params.toString()}`);
    setOpen(false);
  }

  function clearAll() {
    setDraftSort(null);
    setDraftRadius(null);
    setDraftBandKey(undefined);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("sort");
    params.delete("radiusM");
    params.delete("minPrice");
    params.delete("maxPrice");
    router.push(`/?${params.toString()}`);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPanel())}
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
              {/* "Liên quan nhất" isn't a text-relevance score — with no
                  sort chosen, search_combos() (0008) falls through every
                  CASE branch in its ORDER BY and lands on plain distance,
                  same as the default homepage load. It's really "gần bạn
                  nhất" under another name whenever a text/price filter is
                  also active. Kept the familiar label since that's still
                  the sensible default; not worth a confusing rename for a
                  detail most users never need to think about. */}
              <p className="text-sm font-medium">Sắp xếp</p>
              <div className="flex flex-wrap gap-1.5">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDraftSort((s) => (s === opt.value ? null : opt.value))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      draftSort === opt.value
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
                    onClick={() => setDraftRadius((r) => (r === opt.value ? null : opt.value))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      draftRadius === opt.value
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
                    onClick={() => setDraftBandKey((k) => (k === band.key ? undefined : band.key))}
                    className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                      draftBandKey === band.key
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={clearAll}
                className="rounded-md border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                Xoá bộ lọc
              </button>
              <button
                type="button"
                onClick={applyFilters}
                className="flex-1 rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
