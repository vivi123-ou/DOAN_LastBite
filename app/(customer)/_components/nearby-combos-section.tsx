"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { getCurrentPosition } from "@/lib/geo/geolocation";
import { ComboList } from "@/components/combo/combo-list";
import type { NearbyCombo } from "@/lib/domain/combo";

type Status = "locating" | "loading" | "ready" | "denied" | "error";

export function NearbyCombosSection() {
  const searchParams = useSearchParams();
  const categoryId = searchParams.get("categoryId");
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
        const res = await fetch(`/api/combos/nearby?${params.toString()}`);
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const { combos } = await res.json();
        setCombos(combos);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    return () => {
      cancelled = true;
    };
  }, [categoryId]);

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
