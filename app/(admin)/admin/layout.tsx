import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { AdminSidebar } from "@/app/(admin)/admin/_components/admin-sidebar";

// The actual access gate for the whole /admin area — proxy.ts only requires
// being logged in (same as /dashboard, /orders...), the role = 'admin'
// check happens here, once, for every nested admin page. redirect("/")
// rather than a 404/403 page: a non-admin poking at /admin should just land
// back on the normal site, not get a hint that a special area exists to
// probe further.
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login?next=/admin");

  const profile = await getById(supabase, userId);
  if (!profile || profile.role !== "admin") redirect("/");

  return (
    <div className="mx-auto flex max-w-6xl flex-col sm:flex-row">
      <aside className="border-b px-3 py-3 sm:sticky sm:top-16 sm:h-[calc(100vh-4rem)] sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r sm:py-6">
        <AdminSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
