"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Coordinates } from "@/lib/geo/geolocation";

const pinIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function ClickToMove({ onChange }: { onChange: (c: Coordinates) => void }) {
  useMapEvents({
    click(e) {
      onChange({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Recenters the map when coords change from *outside* direct interaction
// with the map itself (GPS button, address geocode) — also fires after a
// drag/click, which just keeps the pin comfortably centered, harmless.
function RecenterOnChange({ center }: { center: Coordinates }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.lat, center.lng], map.getZoom());
  }, [center.lat, center.lng, map]);
  return null;
}

// Google-Maps-style pick-a-location control: drag the pin or click
// anywhere on the map to move it, in addition to the GPS button and
// address-geocode flow in store-fields.tsx. Must be dynamically imported
// with { ssr: false } wherever it's used — same rule as map-view.tsx,
// Leaflet touches window.
export function LocationPickerMap({
  coords,
  onChange,
}: {
  coords: Coordinates;
  onChange: (c: Coordinates) => void;
}) {
  return (
    <MapContainer
      center={[coords.lat, coords.lng]}
      zoom={16}
      scrollWheelZoom={false}
      className="h-56 w-full rounded-md"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[coords.lat, coords.lng]}
        icon={pinIcon}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const pos = e.target.getLatLng();
            onChange({ lat: pos.lat, lng: pos.lng });
          },
        }}
      />
      <ClickToMove onChange={onChange} />
      <RecenterOnChange center={coords} />
    </MapContainer>
  );
}
