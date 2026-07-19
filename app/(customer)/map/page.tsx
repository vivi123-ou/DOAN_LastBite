"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { getCurrentPosition, type Coordinates } from "@/lib/geo/geolocation";
import type { NearbyCombo } from "@/lib/domain/combo";

const MapView = dynamic(
  () => import("@/components/map/map-view").then((mod) => mod.MapView),
  { ssr: false }
);

type Status = "locating" | "loading" | "ready" | "denied" | "error";

export default function MapPage() {
  const [status, setStatus] = useState<Status>("locating");
  const [center, setCenter] = useState<Coordinates | null>(null);
  const [combos, setCombos] = useState<NearbyCombo[]>([]);
  const [storeLocations, setStoreLocations] = useState<Record<string, Coordinates>>({});

  useEffect(() => {
    let cancelled = false;

    getCurrentPosition()
      .then(async (coords) => {
        if (cancelled) return;
        setCenter(coords);
        setStatus("loading");
        const res = await fetch(`/api/combos/nearby?lat=${coords.lat}&lng=${coords.lng}`);
        if (cancelled) return;
        if (!res.ok) {
          setStatus("error");
          return;
        }
        const data = await res.json();
        setCombos(data.combos);
        setStoreLocations(data.storeLocations);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("denied");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "locating" || status === "loading" || !center) {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        Đang tải bản đồ cửa hàng gần bạn...
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="p-8 text-center text-sm text-muted-foreground">
        LastBite cần quyền truy cập vị trí để hiển thị bản đồ. Vui lòng cho phép định vị và tải
        lại trang.
      </p>
    );
  }

  if (status === "error") {
    return <p className="p-8 text-center text-sm text-destructive">Không tải được bản đồ.</p>;
  }

  return (
    <div className="h-[calc(100vh-4rem)] w-full">
      <MapView combos={combos} storeLocations={storeLocations} center={center} />
    </div>
  );
}
