import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { search, type SearchComboOptions } from "@/lib/repositories/combo.repository";

const SORT_VALUES = ["relevance", "price_asc", "price_desc"] as const;

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "lat and lng query params are required" }, { status: 400 });
  }

  const sortParam = params.get("sort");
  const sortBy = SORT_VALUES.includes(sortParam as (typeof SORT_VALUES)[number])
    ? (sortParam as SearchComboOptions["sortBy"])
    : "relevance";

  const minPrice = params.get("minPrice");
  const maxPrice = params.get("maxPrice");

  const supabase = await createClient();
  const combos = await search(supabase, lat, lng, {
    query: params.get("q") ?? undefined,
    categoryId: params.get("categoryId") ?? undefined,
    minPrice: minPrice ? Number(minPrice) : undefined,
    maxPrice: maxPrice ? Number(maxPrice) : undefined,
    sortBy,
  });

  return NextResponse.json({ combos });
}
