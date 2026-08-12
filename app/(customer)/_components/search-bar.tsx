"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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

// Coordinates with nearby-combos-section.tsx purely through the URL
// (?q=&sort=&minPrice=&maxPrice=), the same mechanism category-rail.tsx
// already uses for ?categoryId= — one shared state model for the whole
// discovery area instead of a separate lifted-state shell.
export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [sort, setSort] = useState(searchParams.get("sort") ?? "relevance");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const [showPriceFilter, setShowPriceFilter] = useState(
    Boolean(searchParams.get("minPrice") || searchParams.get("maxPrice"))
  );

  function applyFilters(overrides: { sort?: string } = {}) {
    const params = new URLSearchParams(searchParams.toString());
    const nextSort = overrides.sort ?? sort;

    if (query) params.set("q", query);
    else params.delete("q");

    if (nextSort && nextSort !== "relevance") params.set("sort", nextSort);
    else params.delete("sort");

    if (minPrice) params.set("minPrice", minPrice);
    else params.delete("minPrice");

    if (maxPrice) params.set("maxPrice", maxPrice);
    else params.delete("maxPrice");

    router.push(`/?${params.toString()}`);
  }

  return (
    <div className="space-y-2">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm combo hoặc cửa hàng..."
            className="pl-9"
          />
        </div>

        <Select
          value={sort}
          onValueChange={(value) => {
            const next = value ?? "relevance";
            setSort(next);
            applyFilters({ sort: next });
          }}
          items={SORT_OPTIONS}
        >
          <SelectTrigger className="sm:w-48">
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

        <Button
          type="button"
          variant="outline"
          onClick={() => setShowPriceFilter((v) => !v)}
        >
          <SlidersHorizontal className="mr-2 size-4" />
          Lọc giá
        </Button>

        <Button type="submit">Tìm kiếm</Button>
      </form>

      {showPriceFilter && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3">
          <span className="text-sm text-muted-foreground">Khoảng giá:</span>
          <Input
            type="number"
            min={0}
            placeholder="Từ (đ)"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="w-32"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            placeholder="Đến (đ)"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="w-32"
          />
          <Button type="button" size="sm" onClick={() => applyFilters()}>
            Áp dụng
          </Button>
        </div>
      )}
    </div>
  );
}
