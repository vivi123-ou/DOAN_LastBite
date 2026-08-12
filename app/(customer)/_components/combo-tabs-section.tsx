"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { ComboList } from "@/components/combo/combo-list";
import type { NearbyCombo } from "@/lib/domain/combo";

type TabKey = "nearby" | "newest" | "recommended";

const TABS: { key: TabKey; label: string }[] = [
  { key: "nearby", label: "Gần bạn nhất" },
  { key: "newest", label: "Mới nhất" },
  { key: "recommended", label: "Gợi ý cho bạn" },
];

type LoadState = "loading" | "ready" | "error";

// The homepage's default (no active search/filter) browsing view — three
// independently-fetched tabs sharing one resolved GPS position, each still
// tagged onto its cards via ComboCard's `tag` prop so a viewer always knows
// why a card is showing. Separate from the search-results view
// (search-results-section.tsx) that takes over once a `q`/`sort`/
// `minPrice`/`maxPrice`/`radiusM` filter is active — see page.tsx for the
// switch between the two.
//
// Cache is keyed by `${tab}:${categoryId}` rather than by tab alone, so a
// changed category filter naturally lands on a fresh cache slot instead of
// needing an effect that clears the old one on every categoryId change
// (react-hooks/set-state-in-effect flags synchronous setState-in-effect,
// and this sidesteps the pattern entirely rather than working around it).
export function ComboTabsSection({ recommendedCategoryId }: { recommendedCategoryId?: string }) {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? undefined;

  const [activeTab, setActiveTab] = useState<TabKey>("nearby");
  const [locationState, setLocationState] = useState<"locating" | "ready" | "denied">("locating");
  const coordsRef = useRef<Coordinates | null>(null);
  const [combosByKey, setCombosByKey] = useState<Record<string, NearbyCombo[]>>({});
  const [stateByKey, setStateByKey] = useState<Record<string, LoadState>>({});

  const cacheKey = `${activeTab}:${categoryId ?? ""}`;

  useEffect(() => {
    let cancelled = false;
    getCurrentPosition()
      .then((coords) => {
        if (cancelled) return;
        coordsRef.current = coords;
        setLocationState("ready");
      })
      .catch(() => {
        if (!cancelled) setLocationState("denied");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (locationState !== "ready" || !coordsRef.current) return;
    if (stateByKey[cacheKey]) return; // already fetched (or in flight) for this tab+filter

    let cancelled = false;
    const { lat, lng } = coordsRef.current;

    // Deferred into a microtask rather than called synchronously in the
    // effect body — same shape as the getCurrentPosition().then(...) call
    // above, which react-hooks/set-state-in-effect already accepts.
    Promise.resolve().then(async () => {
      if (cancelled) return;
      setStateByKey((s) => ({ ...s, [cacheKey]: "loading" }));

      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      let endpoint = "/api/combos/nearby";

      if (activeTab === "nearby") {
        if (categoryId) params.set("categoryId", categoryId);
      } else if (activeTab === "newest") {
        endpoint = "/api/combos/search";
        params.set("sort", "newest");
        if (categoryId) params.set("categoryId", categoryId);
      } else {
        if (!recommendedCategoryId) {
          setCombosByKey((c) => ({ ...c, [cacheKey]: [] }));
          setStateByKey((s) => ({ ...s, [cacheKey]: "ready" }));
          return;
        }
        params.set("categoryId", recommendedCategoryId);
      }

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (cancelled) return;
      if (!res.ok) {
        setStateByKey((s) => ({ ...s, [cacheKey]: "error" }));
        return;
      }
      const { combos } = await res.json();
      if (cancelled) return;
      setCombosByKey((c) => ({ ...c, [cacheKey]: combos }));
      setStateByKey((s) => ({ ...s, [cacheKey]: "ready" }));
    });

    return () => {
      cancelled = true;
    };
  }, [activeTab, locationState, categoryId, recommendedCategoryId, cacheKey, stateByKey]);

  const status = stateByKey[cacheKey];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:border-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {locationState === "locating" && (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <MapPin className="size-4 animate-pulse" />
          Đang tìm combo gần bạn...
        </p>
      )}

      {locationState === "denied" && (
        <p className="py-8 text-sm text-muted-foreground">
          LastBite cần quyền truy cập vị trí để tìm combo gần bạn. Vui lòng cho phép định vị và tải
          lại trang.
        </p>
      )}

      {locationState === "ready" && status === "loading" && (
        <p className="py-8 text-sm text-muted-foreground">Đang tải...</p>
      )}

      {locationState === "ready" && status === "error" && (
        <p className="py-8 text-sm text-destructive">Không tải được danh sách combo, thử lại sau.</p>
      )}

      {locationState === "ready" && status === "ready" && activeTab === "recommended" && !recommendedCategoryId && (
        <p className="py-8 text-sm text-muted-foreground">
          Mua vài đơn nữa để LastBite hiểu khẩu vị của bạn và gợi ý combo phù hợp nhé!
        </p>
      )}

      {locationState === "ready" &&
        status === "ready" &&
        (activeTab !== "recommended" || recommendedCategoryId) && (
          <ComboList
            combos={combosByKey[cacheKey] ?? []}
            tag={TABS.find((t) => t.key === activeTab)?.label}
          />
        )}
    </div>
  );
}
