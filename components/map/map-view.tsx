"use client";

import { useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { NearbyCombo } from "@/lib/domain/combo";
import { StoreDetailPanel } from "@/components/map/store-detail-panel";

// Bundlers break Leaflet's default marker icon path resolution — point it at
// the CDN copies instead of trying to wire up local asset imports.
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const userIcon = L.divIcon({
  className: "",
  html: '<div style="width:16px;height:16px;border-radius:9999px;background:oklch(0.627 0.194 149.214);border:3px solid white;box-shadow:0 0 0 2px oklch(0.627 0.194 149.214 / 40%)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

interface StoreGroup {
  storeId: string;
  storeName: string;
  lat: number;
  lng: number;
  combos: NearbyCombo[];
}

export function MapView({
  combos,
  storeLocations,
  center,
}: {
  combos: NearbyCombo[];
  storeLocations: Record<string, { lat: number; lng: number }>;
  center: { lat: number; lng: number };
}) {
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byStore = new Map<string, StoreGroup>();
    for (const combo of combos) {
      const location = storeLocations[combo.storeId];
      if (!location) continue;
      const existing = byStore.get(combo.storeId);
      if (existing) {
        existing.combos.push(combo);
      } else {
        byStore.set(combo.storeId, {
          storeId: combo.storeId,
          storeName: combo.storeName,
          lat: location.lat,
          lng: location.lng,
          combos: [combo],
        });
      }
    }
    return Array.from(byStore.values());
  }, [combos, storeLocations]);

  return (
    // `isolate` contains Leaflet's own internal z-index values (its panes
    // and controls go up to ~1000) inside this element's own stacking
    // context, so they never leak out to compete with the site header's
    // dropdowns (Menu/search/notifications, all z-50 — see
    // site-menu.tsx etc.) at the page level. Without this, Leaflet's
    // markers/controls rendered *above* the header's own menu dropdown
    // despite the header being later/higher in the DOM — reported live on
    // the /map page.
    <div className="relative isolate h-full w-full">
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={14}
        scrollWheelZoom
        className="h-full w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[center.lat, center.lng]} icon={userIcon}>
          <Popup>Vị trí của bạn</Popup>
        </Marker>
        {groups.map((group) => (
          <Marker
            key={group.storeId}
            position={[group.lat, group.lng]}
            icon={defaultIcon}
            eventHandlers={{ click: () => setSelectedStoreId(group.storeId) }}
          />
        ))}
      </MapContainer>

      {/* Replaces the old per-marker Leaflet Popup — clicking a store pin
          now opens this full detail panel (banner, address, paginated
          combo list) on the left instead of a small inline list. */}
      {selectedStoreId && (
        <StoreDetailPanel
          key={selectedStoreId}
          storeId={selectedStoreId}
          onClose={() => setSelectedStoreId(null)}
        />
      )}
    </div>
  );
}
