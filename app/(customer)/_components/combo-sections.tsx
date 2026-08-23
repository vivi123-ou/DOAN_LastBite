"use client";

import { useEffect, useRef, useState } from "react";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import { ComboCarousel } from "@/components/combo/combo-carousel";
import { recordSponsoredImpressionsAction } from "@/app/(customer)/_components/ad-tracking.actions";
import type { NearbyCombo } from "@/lib/domain/combo";
import type { Category } from "@/lib/domain/category";

type SectionKey = "newest" | "recommended";

const SECTIONS: { key: SectionKey; title: string; viewAllHref?: string }[] = [
  { key: "newest", title: "Mới nhất", viewAllHref: "/?sort=newest" },
  { key: "recommended", title: "Gợi ý cho bạn" },
];

// Same city-center fallback already used elsewhere in this app (the store
// location picker's default map center) — lets every section render real
// results immediately, instead of the homepage sitting on a blank "Đang
// tìm vị trí..." screen until the browser's GPS permission prompt
// resolves. Silently upgraded to the customer's real coordinates in the
// background once/if geolocation resolves (see the second useEffect) — no
// loading state anyone has to wait through for that upgrade. There's no
// dedicated "Gần bạn nhất" row here anymore (removed per explicit
// feedback, once nearby-fab.tsx's floating map button already covers
// that exact job) — nothing else on this page needs the real position
// though, so this "upgrade in place" is enough.
const DEFAULT_CENTER: Coordinates = { lat: 10.7769, lng: 106.7009 };

// The homepage's default "Tất cả" browsing view (no category/search filter
// active) — a curated "Sản phẩm được tài trợ" row (when any exist) up top,
// then curated carousel rows, then one row per category so every listed
// type gets its own shelf. Selecting a specific category pill
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
  const realCoordsRef = useRef<Coordinates | null>(null);
  const [combosBySection, setCombosBySection] = useState<Partial<Record<SectionKey, NearbyCombo[]>>>(
    {}
  );
  const [combosByCategory, setCombosByCategory] = useState<Record<string, NearbyCombo[]>>({});

  async function fetchSection(key: SectionKey, coords: Coordinates) {
    const params = new URLSearchParams({ lat: String(coords.lat), lng: String(coords.lng) });
    let endpoint = "/api/combos/nearby";

    if (key === "newest") {
      endpoint = "/api/combos/search";
      params.set("sort", "newest");
    } else if (key === "recommended") {
      if (!recommendedCategoryId) {
        setCombosBySection((c) => ({ ...c, recommended: [] }));
        return;
      }
      params.set("categoryId", recommendedCategoryId);
    }

    const res = await fetch(`${endpoint}?${params.toString()}`);
    if (!res.ok) return;
    const { combos } = await res.json();
    setCombosBySection((c) => ({ ...c, [key]: combos }));
  }

  async function fetchCategory(categoryId: string, coords: Coordinates) {
    const params = new URLSearchParams({ lat: String(coords.lat), lng: String(coords.lng), categoryId });
    const res = await fetch(`/api/combos/nearby?${params.toString()}`);
    if (!res.ok) return;
    const { combos } = await res.json();
    setCombosByCategory((c) => ({ ...c, [categoryId]: combos }));
  }

  // Fires immediately on mount, on the fallback city center — nothing on
  // this page waits for real geolocation to show something real. Deferred
  // one microtask (same Promise.resolve().then() escape hatch this
  // component already relied on before) so the fetch calls' eventual
  // setState doesn't happen synchronously within the effect body itself
  // (react-hooks/set-state-in-effect).
  useEffect(() => {
    Promise.resolve().then(() => {
      fetchSection("newest", DEFAULT_CENTER);
      fetchSection("recommended", DEFAULT_CENTER);
      categories.forEach((cat) => fetchCategory(cat.id, DEFAULT_CENTER));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once on mount, categories/recommendedCategoryId changing mid-session isn't a case this page needs to react to
  }, []);

  // Silently upgrades every row from the city-center default to the
  // customer's real coordinates once/if geolocation resolves — a nicer
  // result set, not a loading state anyone has to wait through, and
  // nothing shows an error if it's denied (there's no dedicated row left
  // on this page that strictly needs it).
  useEffect(() => {
    let cancelled = false;
    getCurrentPosition()
      .then((coords) => {
        if (cancelled) return;
        realCoordsRef.current = coords;
        fetchSection("newest", coords);
        fetchSection("recommended", coords);
        categories.forEach((cat) => fetchCategory(cat.id, coords));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fires once on mount, same reasoning as the effect above
  }, []);

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

  // A dedicated, prominent "được tài trợ" shelf up top — gathered from
  // whatever's already loaded across every other row rather than a
  // separate fetch, deduped by comboId (the same sponsored combo often
  // legitimately also appears in its own category's shelf; showing it here
  // too is the point — advertisers pay for extra prominence, not just an
  // in-context badge).
  const sponsoredCombos = (() => {
    const all = [...Object.values(combosBySection).flat(), ...Object.values(combosByCategory).flat()];
    const seen = new Set<string>();
    return all.filter((c) => {
      if (!c.isSponsored || seen.has(c.comboId)) return false;
      seen.add(c.comboId);
      return true;
    });
  })();

  return (
    <div className="space-y-8">
      {sponsoredCombos.length > 0 && (
        <ComboCarousel
          title="Ưu đãi nổi bật"
          combos={sponsoredCombos}
          viewerStoreId={viewerStoreId}
          isAdmin={isAdmin}
          variant="hot"
        />
      )}

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
            viewAllHref={section.viewAllHref}
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
            viewAllHref={`/?categoryId=${cat.id}`}
          />
        );
      })}
    </div>
  );
}
