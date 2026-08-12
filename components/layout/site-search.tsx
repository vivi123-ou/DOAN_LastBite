"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ImageOff, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import type { NearbyCombo } from "@/lib/domain/combo";

const DEBOUNCE_MS = 300;
const DROPDOWN_LIMIT = 6;

// Global, always-in-header instant-search (inbook.vn's header search is the
// reference — type a name, get a small dropdown of matching products with
// thumbnail + price, "Xem tất cả kết quả" at the bottom). Separate concern
// from the homepage's own SearchBar (sort + price-range filter panel):
// this one is for fast type-ahead jump-to-product from *any* page, that one
// is for deliberate browsing once already on the homepage.
export function SiteSearch() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const coordsRef = useRef<Coordinates | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const [value, setValue] = useState("");
  const [results, setResults] = useState<NearbyCombo[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function scheduleSearch(query: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = query.trim();
    if (!trimmed) {
      setResults(null);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        if (!coordsRef.current) {
          coordsRef.current = await getCurrentPosition();
        }
        const params = new URLSearchParams({
          lat: String(coordsRef.current.lat),
          lng: String(coordsRef.current.lng),
          q: trimmed,
          limit: String(DROPDOWN_LIMIT),
        });
        const res = await fetch(`/api/combos/search?${params.toString()}`);
        if (requestId !== requestIdRef.current) return;
        if (!res.ok) {
          setResults([]);
          return;
        }
        const { combos } = await res.json();
        if (requestId !== requestIdRef.current) return;
        setResults(combos);
      } catch {
        // Geolocation denied/unavailable — no dropdown preview, but Enter
        // still navigates to the full results page which has its own
        // location-permission messaging (nearby-combos-section.tsx).
        if (requestId === requestIdRef.current) setResults([]);
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);
  }

  function goToResults(query: string) {
    setOpen(false);
    const trimmed = query.trim();
    if (!trimmed) return;
    router.push(`/?q=${encodeURIComponent(trimmed)}`);
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

  const showDropdown = open && value.trim().length > 0;

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          goToResults(value);
        }}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
              scheduleSearch(e.target.value);
            }}
            onFocus={() => value.trim() && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Tìm combo hoặc cửa hàng..."
            className="pl-9"
          />
        </div>
      </form>

      {showDropdown && (
        <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] overflow-y-auto rounded-md border bg-popover shadow-lg">
          {loading && !results && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Đang tìm...</p>
          )}
          {results && results.length === 0 && !loading && (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Không tìm thấy combo nào phù hợp.
            </p>
          )}
          {results && results.length > 0 && (
            <>
              <ul>
                {results.map((combo) => (
                  <li key={combo.comboId}>
                    <Link
                      href={`/combos/${combo.comboId}`}
                      onClick={() => setOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                        {combo.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                          <img
                            src={combo.imageUrl}
                            alt=""
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageOff className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{combo.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{combo.storeName}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-primary">
                          {combo.currentPrice.toLocaleString("vi-VN")}đ
                        </p>
                        {combo.originalPrice > combo.currentPrice && (
                          <p className="text-xs text-muted-foreground line-through">
                            {combo.originalPrice.toLocaleString("vi-VN")}đ
                          </p>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => goToResults(value)}
                className="block w-full border-t px-4 py-2.5 text-center text-sm font-medium text-primary hover:bg-muted"
              >
                Xem tất cả kết quả cho “{value.trim()}”
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
