import Link from "next/link";
import { MapPin } from "lucide-react";

// The explicit alternative to gating the whole homepage on geolocation:
// general browsing (Mới nhất, category shelves) now renders immediately on
// a city-center default (see combo-sections.tsx), so this floating button
// is the one deliberate, opt-in entry point into "combo thật sự gần tôi"
// (via /map, which already does real-position browsing on a real map) —
// a small bounce animation to actually get noticed, not a normal nav link
// easily missed among the header's other icons.
export function NearbyFab() {
  return (
    <Link
      href="/map"
      className="fixed bottom-6 right-6 z-40 flex animate-bounce items-center gap-1.5 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
    >
      <MapPin className="size-4" />
      Sản phẩm gần bạn
    </Link>
  );
}
