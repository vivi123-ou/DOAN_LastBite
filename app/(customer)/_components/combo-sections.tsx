"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { ComboCarousel } from "@/components/combo/combo-carousel";
import type { NearbyCombo } from "@/lib/domain/combo";

type SectionKey = "nearby" | "newest" | "recommended";

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: "nearby", title: "Gần bạn nhất" },
  { key: "newest", title: "Mới nhất" },
  { key: "recommended", title: "Gợi ý cho bạn" },
];

// The homepage's default (no active search/filter) browsing view — three
// stacked horizontal carousel rows (not tabs you switch between — explicit
// feedback was that a tab switcher hid too much at once, a real inbook.vn-
// style "row per section" reads better), each fetched independently and
// tagged onto its cards via ComboCard's `tag` prop. Separate from the
// search-results view (search-results-section.tsx) that takes over once a
// `q`/`sort`/`minPrice`/`maxPrice`/`radiusM` filter is active — see
// page.tsx for the switch between the two.
export function ComboSections({ recommendedCategoryId }: { recommendedCategoryId?: string }) {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId") ?? undefined;

  const [locationState, setLocationState] = useState<"locating" | "ready" | "denied">("locating");
  const coordsRef = useRef<Coordinates | null>(null);
  const [combosBySection, setCombosBySection] = useState<Partial<Record<SectionKey, NearbyCombo[]>>>(
    {}
  );

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
    let cancelled = false;
    const { lat, lng } = coordsRef.current;

    async function fetchSection(key: SectionKey) {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      let endpoint = "/api/combos/nearby";

      if (key === "nearby") {
        if (categoryId) params.set("categoryId", categoryId);
      } else if (key === "newest") {
        endpoint = "/api/combos/search";
        params.set("sort", "newest");
        if (categoryId) params.set("categoryId", categoryId);
      } else {
        if (!recommendedCategoryId) {
          if (!cancelled) setCombosBySection((c) => ({ ...c, recommended: [] }));
          return;
        }
        params.set("categoryId", recommendedCategoryId);
      }

      const res = await fetch(`${endpoint}?${params.toString()}`);
      if (cancelled || !res.ok) return;
      const { combos } = await res.json();
      if (cancelled) return;
      setCombosBySection((c) => ({ ...c, [key]: combos }));
    }

    // All three sections load in parallel — they're independent rows shown
    // at once now, not lazily fetched per active tab.
    Promise.resolve().then(() => {
      fetchSection("nearby");
      fetchSection("newest");
      fetchSection("recommended");
    });

    return () => {
      cancelled = true;
    };
  }, [locationState, categoryId, recommendedCategoryId]);

  if (locationState === "locating") {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <MapPin className="size-4 animate-pulse" />
        Đang tìm combo gần bạn...
      </p>
    );
  }

  if (locationState === "denied") {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        LastBite cần quyền truy cập vị trí để tìm combo gần bạn. Vui lòng cho phép định vị và tải
        lại trang.
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {SECTIONS.map((section) => {
        if (section.key === "recommended" && !recommendedCategoryId) {
          return (
            <ComboCarousel
              key={section.key}
              title={section.title}
              combos={[]}
              emptyMessage="Mua vài đơn nữa để LastBite hiểu khẩu vị của bạn và gợi ý combo phù hợp nhé!"
            />
          );
        }

        const combos = combosBySection[section.key];
        if (combos === undefined) {
          // Not yet loaded — distinct from "loaded, zero results" so the
          // carousel's own empty-state text doesn't flash during the fetch.
          return (
            <section key={section.key} className="space-y-3">
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <p className="py-6 text-sm text-muted-foreground">Đang tải...</p>
            </section>
          );
        }

        return (
          <ComboCarousel key={section.key} title={section.title} combos={combos} tag={section.title} />
        );
      })}
    </div>
  );
}
