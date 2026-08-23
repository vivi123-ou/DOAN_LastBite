import Link from "next/link";

// Small original SVG (a folded paper map + a red drop pin) — not a traced
// copy of any specific stock icon, just the same common "location" visual
// metaphor recreated with plain shapes, so there's no licensing question
// about where it came from. Sized to sit inside the green circular button
// below.
function MapPinGraphic() {
  return (
    <svg viewBox="0 0 64 64" className="size-7 shrink-0" aria-hidden>
      <polygon points="8,22 22,16 42,16 56,22 56,48 42,42 22,42 8,48" fill="white" opacity="0.95" />
      <line x1="22" y1="16" x2="22" y2="42" stroke="#93c5fd" strokeWidth="2" />
      <line x1="42" y1="16" x2="42" y2="42" stroke="#93c5fd" strokeWidth="2" />
      <path
        d="M32 6c-8.8 0-16 7.2-16 16 0 12 16 30 16 30s16-18 16-30c0-8.8-7.2-16-16-16z"
        fill="#ef4444"
      />
      <circle cx="32" cy="22" r="6.5" fill="white" />
    </svg>
  );
}

// The explicit alternative to gating the whole homepage on geolocation:
// general browsing (Mới nhất, category shelves) renders immediately on a
// city-center default (see combo-sections.tsx, which no longer has its own
// "Gần bạn nhất" row now that this button covers that job), so this
// floating button is the one deliberate, opt-in entry point into "combo
// thật sự gần tôi" (via /map, which already does real-position browsing on
// a real map) — a small bounce animation to actually get noticed, not a
// normal nav link easily missed among the header's other icons.
export function NearbyFab() {
  return (
    <Link
      href="/map"
      className="fixed bottom-6 right-6 z-40 flex animate-bounce items-center gap-2 rounded-full bg-primary py-2.5 pl-2.5 pr-4 text-sm font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105"
    >
      <MapPinGraphic />
      Sản phẩm gần bạn
    </Link>
  );
}
