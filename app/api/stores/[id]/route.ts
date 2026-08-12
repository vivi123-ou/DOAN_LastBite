import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getById } from "@/lib/repositories/store.repository";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const store = await getById(supabase, id);
  if (!store) return NextResponse.json({ error: "Không tìm thấy cửa hàng" }, { status: 404 });
  return NextResponse.json({ store });
}
