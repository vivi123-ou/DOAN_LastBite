"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SORT_OPTIONS = [
  { value: "relevance", label: "Liên quan nhất" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
];

// Shopee-style click-to-select bands instead of free-typed min/max — the
// user's explicit feedback was "bấm chọn trong khoảng ... thay vì bắt người
// dùng gõ nhập". `undefined` bounds mean "open-ended" (no lower/upper limit).
const PRICE_BANDS: { key: string; label: string; min?: number; max?: number }[] = [
  { key: "under-30k", label: "Dưới 30.000đ", max: 30_000 },
  { key: "30-60k", label: "30.000đ - 60.000đ", min: 30_000, max: 60_000 },
  { key: "60-100k", label: "60.000đ - 100.000đ", min: 60_000, max: 100_000 },
  { key: "100-200k", label: "100.000đ - 200.000đ", min: 100_000, max: 200_000 },
  { key: "over-200k", label: "Trên 200.000đ", min: 200_000 },
];

// The free-text query box lives in the header now (site-search.tsx) — this
// panel is purely the "browsing filters" half (sort + price band), reached
// via the same URL searchParams contract (`q`/`sort`/`minPrice`/`maxPrice`)
// that category-rail.tsx already established for `categoryId`. `q` is only
// ever *read* here (to show/clear it), never typed here.
export function FilterBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") ?? "";
  const sort = searchParams.get("sort") ?? "relevance";
  const minPrice = searchParams.get("minPrice") ?? "";
  const maxPrice = searchParams.get("maxPrice") ?? "";

  const activeBandKey = PRICE_BANDS.find(
    (band) => String(band.min ?? "") === minPrice && String(band.max ?? "") === maxPrice
  )?.key;

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
    <div className="space-y-2">
      {query && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Đang lọc theo:</span>
          <button
            type="button"
            onClick={() => pushParams({ q: undefined })}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 font-medium text-primary hover:bg-primary/20"
          >
            “{query}”
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={sort}
          onValueChange={(value) => pushParams({ sort: value && value !== "relevance" ? value : undefined })}
          items={SORT_OPTIONS}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRICE_BANDS.map((band) => {
            const active = band.key === activeBandKey;
            return (
              <button
                key={band.key}
                type="button"
                onClick={() => togglePriceBand(band)}
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input text-muted-foreground hover:border-primary hover:text-primary"
                }`}
              >
                {band.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
