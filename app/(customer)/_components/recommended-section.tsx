"use client";

import { useEffect, useState } from "react";
import { getCurrentPosition } from "@/lib/geo/geolocation";
import { ComboList } from "@/components/combo/combo-list";
import type { NearbyCombo } from "@/lib/domain/combo";

// Only rendered by page.tsx when the signed-in customer has ≥1 past order
// (server-side check via getTopPurchasedCategoryIds) — GPS still has to be
// resolved client-side like the rest of the discovery area, so this stays a
// small client component reusing the same /api/combos/nearby endpoint,
// just pre-filtered to the customer's most-ordered category.
export function RecommendedSection({ categoryId }: { categoryId: string }) {
  const [combos, setCombos] = useState<NearbyCombo[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    getCurrentPosition()
      .then(async ({ lat, lng }) => {
        const params = new URLSearchParams({ lat: String(lat), lng: String(lng), categoryId });
        const res = await fetch(`/api/combos/nearby?${params.toString()}`);
        if (cancelled || !res.ok) return;
        const { combos } = await res.json();
        setCombos(combos);
      })
      .catch(() => {
        // Silent — this is a bonus section, not core functionality.
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

  if (!combos || combos.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Có thể bạn thích</h2>
      <ComboList combos={combos} />
    </section>
  );
}
