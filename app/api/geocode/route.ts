import { NextResponse, type NextRequest } from "next/server";

// Server-side proxy to OpenStreetMap's Nominatim search API — same free,
// no-billing-account stack choice already made for the map itself
// (Leaflet + OSM tiles, see CLAUDE.md §2). Done server-side rather than
// called directly from the browser: Nominatim's usage policy asks for a
// descriptive User-Agent identifying the calling application, which
// browser fetch/XHR can't override (browsers block overriding that
// header client-side) — a server route can set it freely. One user
// action = one request here, well within Nominatim's 1 req/sec policy;
// no queue/rate-limiter needed at this traffic scale.
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ error: "q is required" }, { status: 400 });

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "vn");

  const res = await fetch(url, {
    headers: {
      "User-Agent": "LastBite-Capstone/1.0 (contact: via Supabase project owner)",
      "Accept-Language": "vi",
    },
  });
  if (!res.ok) {
    return NextResponse.json({ error: "Không tra được toạ độ" }, { status: 502 });
  }

  const results = (await res.json()) as { lat: string; lon: string; display_name: string }[];
  const first = results[0];
  if (!first) return NextResponse.json({ result: null });

  return NextResponse.json({
    result: { lat: Number(first.lat), lng: Number(first.lon), displayName: first.display_name },
  });
}
