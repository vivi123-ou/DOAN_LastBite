import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listActiveByStorePaginated } from "@/lib/repositories/combo.repository";

const PAGE_SIZE = 10;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);

  const supabase = await createClient();
  const { combos, hasMore } = await listActiveByStorePaginated(supabase, id, {
    limit: PAGE_SIZE,
    offset: Number.isFinite(offset) && offset >= 0 ? offset : 0,
  });

  return NextResponse.json({ combos, hasMore });
}
