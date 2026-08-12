"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { getCurrentPosition } from "@/lib/geo/geolocation";
import { ComboList } from "@/components/combo/combo-list";
import { createClient } from "@/lib/supabase/client";
import { record } from "@/lib/repositories/search-history.repository";
import type { NearbyCombo } from "@/lib/domain/combo";

type Status = "locating" | "loading" | "ready" | "denied" | "error";

// Renders instead of ComboSections whenever a search/filter is active (q /
// sort / minPrice / maxPrice / radiusM / categoryId in the URL — see
// page.tsx's switch). Always goes through search_combos() (see
// combo.repository.ts's search()) rather than nearby_combos() — this view
// exists precisely *because* a filter/sort beyond pure distance is in play.
//
// Picking a specific category pill (category-rail.tsx) lands here too —
// explicit feedback was that browsing one category should show a single
// newest-sorted list, not the "Tất cả" multi-row layout repeated for just
// that category. So a categoryId with no explicit `sort` chosen defaults
// to "newest" rather than falling back to relevance/distance.
//
// One heading above the whole list, not a per-card tag (same fix as
// combo-carousel.tsx's rows) — a repeated "Kết quả tìm kiếm" badge on every
// card read as clutter once there's already a heading saying the same
// thing once.
export function SearchResultsSection({ categoryName }: { categoryName?: string }) {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId");
  const query = searchParams.get("q");
  const sort = searchParams.get("sort") ?? (categoryId ? "newest" : null);
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const radiusM = searchParams.get("radiusM");

  const [status, setStatus] = useState<Status>("locating");
  const [combos, setCombos] = useState<NearbyCombo[]>([]);

  useEffect(() => {
    let cancelled = false;

    getCurrentPosition()
      .then(async ({ lat, lng }) => {
        if (cancelled) return;
        setStatus("loading");

        const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
        if (categoryId) params.set("categoryId", categoryId);
        if (query) params.set("q", query);
        if (sort) params.set("sort", sort);
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        if (radiusM) params.set("radiusM", radiusM);

        const res = await fetch(`/api/combos/search?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const { combos } = await res.json();
        setCombos(combos);
        setStatus("ready");

        // Fire-and-forget: save the search term for this signed-in user
        // (search_history_insert_own RLS scopes it to their own rows).
        // Doesn't block showing results either way.
        if (query) {
          const supabase = createClient();
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) record(supabase, user.id, query).catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId, query, sort, minPrice, maxPrice, radiusM]);

  const heading = query ? `Kết quả cho “${query}”` : categoryName ? categoryName : "Kết quả tìm kiếm";

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{heading}</h2>

      {(status === "locating" || status === "loading") && (
        <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <MapPin className="size-4 animate-pulse" />
          Đang tìm combo phù hợp...
        </p>
      )}

      {status === "denied" && (
        <p className="py-8 text-sm text-muted-foreground">
          LastBite cần quyền truy cập vị trí để tìm combo gần bạn. Vui lòng cho phép định vị và tải
          lại trang.
        </p>
      )}

      {status === "error" && (
        <p className="py-8 text-sm text-destructive">Không tải được danh sách combo, thử lại sau.</p>
      )}

      {status === "ready" && <ComboList combos={combos} />}
    </div>
  );
}
