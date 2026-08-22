"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { ComboCarousel } from "@/components/combo/combo-carousel";
import { recordSponsoredImpressionsAction } from "@/app/(customer)/_components/ad-tracking.actions";
import type { NearbyCombo } from "@/lib/domain/combo";
import type { Category } from "@/lib/domain/category";

type SectionKey = "nearby" | "newest" | "recommended";

const SECTIONS: { key: SectionKey; title: string }[] = [
  { key: "nearby", title: "Gần bạn nhất" },
  { key: "newest", title: "Mới nhất" },
  { key: "recommended", title: "Gợi ý cho bạn" },
];

// The homepage's default "Tất cả" browsing view (no category/search filter
// active) — three curated carousel rows, then one row per category so
// every listed type gets its own shelf. Selecting a specific category pill
// (category-rail.tsx) switches the homepage to search-results-section.tsx
// instead (a single newest-sorted list for just that category) — see
// page.tsx's isFiltered switch — so this component never has to handle a
// categoryId itself. No `tag` badge is passed to any card here: every row
// already has its own <h2> title right above it, so a repeated per-card
// tag would just be redundant clutter (a card under "Cà phê" doesn't need
// to also say "Cà phê").
export function ComboSections({
  recommendedCategoryId,
  categories,
  viewerStoreId,
  isAdmin,
}: {
  recommendedCategoryId?: string;
  categories: Category[];
  viewerStoreId?: string;
  isAdmin?: boolean;
}) {
  const [locationState, setLocationState] = useState<"locating" | "ready" | "denied">("locating");
  const coordsRef = useRef<Coordinates | null>(null);
  const [combosBySection, setCombosBySection] = useState<Partial<Record<SectionKey, NearbyCombo[]>>>(
    {}
  );
  const [combosByCategory, setCombosByCategory] = useState<Record<string, NearbyCombo[]>>({});

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

      if (key === "newest") {
        endpoint = "/api/combos/search";
        params.set("sort", "newest");
      } else if (key === "recommended") {
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

    async function fetchCategory(categoryId: string) {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), categoryId });
      const res = await fetch(`/api/combos/nearby?${params.toString()}`);
      if (cancelled || !res.ok) return;
      const { combos } = await res.json();
      if (cancelled) return;
      setCombosByCategory((c) => ({ ...c, [categoryId]: combos }));
    }

    // Every row (the three curated sections + one per category) loads in
    // parallel — they're independent shelves shown at once, not lazily
    // fetched per active tab.
    Promise.resolve().then(() => {
      fetchSection("nearby");
      fetchSection("newest");
      fetchSection("recommended");
      categories.forEach((cat) => fetchCategory(cat.id));
    });

    return () => {
      cancelled = true;
    };
  }, [locationState, recommendedCategoryId, categories]);

  // Impression tracking (0035) — fires once per sponsored combo per page
  // load, not once per re-render: recordedRef tracks which ids have
  // already been counted so a later, unrelated state update (e.g. a
  // different section finishing its own fetch) doesn't double-count a
  // combo whose impression was already recorded.
  const recordedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const allCombos = [...Object.values(combosBySection).flat(), ...Object.values(combosByCategory).flat()];
    const newSponsoredIds = allCombos
      .filter((c) => c.isSponsored && !recordedRef.current.has(c.comboId))
      .map((c) => c.comboId);
    if (newSponsoredIds.length === 0) return;
    newSponsoredIds.forEach((id) => recordedRef.current.add(id));
    void recordSponsoredImpressionsAction(newSponsoredIds);
  }, [combosBySection, combosByCategory]);

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
              viewerStoreId={viewerStoreId}
              isAdmin={isAdmin}
            />
          );
        }

        const combos = combosBySection[section.key];
        if (combos === undefined) {
          // Not yet loaded — distinct from "loaded, zero results" so the
          // carousel's own empty-state text doesn't flash during the fetch.
          return (
            <section key={section.key} className="space-y-3">
              <h2 className="text-xl font-bold sm:text-2xl">{section.title}</h2>
              <p className="py-6 text-sm text-muted-foreground">Đang tải...</p>
            </section>
          );
        }

        return (
          <ComboCarousel
            key={section.key}
            title={section.title}
            combos={combos}
            viewerStoreId={viewerStoreId}
            isAdmin={isAdmin}
          />
        );
      })}

      {categories.map((cat) => {
        const combos = combosByCategory[cat.id];
        if (combos === undefined) {
          return (
            <section key={cat.id} className="space-y-3">
              <h2 className="text-xl font-bold sm:text-2xl">{cat.name}</h2>
              <p className="py-6 text-sm text-muted-foreground">Đang tải...</p>
            </section>
          );
        }
        if (combos.length === 0) return null; // no dead shelf for an empty category
        return (
          <ComboCarousel
            key={cat.id}
            title={cat.name}
            combos={combos}
            viewerStoreId={viewerStoreId}
            isAdmin={isAdmin}
          />
        );
      })}
    </div>
  );
}
