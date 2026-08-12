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

export function NearbyCombosSection() {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId");
  const query = searchParams.get("q");
  const sort = searchParams.get("sort");
  const minPrice = searchParams.get("minPrice");
  const maxPrice = searchParams.get("maxPrice");
  const isFiltered = Boolean(query || sort || minPrice || maxPrice);

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

        // Any active search/price/sort filter switches to search_combos()
        // (see combo.repository.ts) instead of the default nearby_combos()
        // load — different ORDER BY shape, see 0008_search_combos.sql.
        const endpoint = isFiltered ? "/api/combos/search" : "/api/combos/nearby";
        if (isFiltered) {
          if (query) params.set("q", query);
          if (sort) params.set("sort", sort);
          if (minPrice) params.set("minPrice", minPrice);
          if (maxPrice) params.set("maxPrice", maxPrice);
        }

        const res = await fetch(`${endpoint}?${params.toString()}`);
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
  }, [categoryId, query, sort, minPrice, maxPrice, isFiltered]);

  if (status === "locating" || status === "loading") {
    return (
      <p className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <MapPin className="size-4 animate-pulse" />
        Đang tìm combo gần bạn...
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        LastBite cần quyền truy cập vị trí để tìm combo gần bạn. Vui lòng cho phép định vị và tải
        lại trang.
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="py-8 text-sm text-destructive">Không tải được danh sách combo, thử lại sau.</p>
    );
  }

  return <ComboList combos={combos} />;
}
