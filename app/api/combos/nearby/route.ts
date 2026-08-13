import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listNearby } from "@/lib/repositories/combo.repository";
import { getLocationsByIds } from "@/lib/repositories/store.repository";

export async function GET(request: NextRequest) {
  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  // Kept in sync with combo.repository.ts's DEFAULT_RADIUS_M — this route
  // stringifies the param before listNearby() ever sees its own default,
  // so the fallback has to live here too.
  const radiusM = Number(request.nextUrl.searchParams.get("radiusM") ?? 10000);
  const categoryId = request.nextUrl.searchParams.get("categoryId") ?? undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }

  const supabase = await createClient();
  const combos = await listNearby(supabase, lat, lng, radiusM, 20, categoryId);
  const storeLocations = await getLocationsByIds(supabase, [
    ...new Set(combos.map((c) => c.storeId)),
  ]);

  return NextResponse.json({ combos, storeLocations });
}
