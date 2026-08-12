import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/supabase/auth";
import { getById } from "@/lib/repositories/profile.repository";
import { SiteSidebar } from "@/components/layout/site-sidebar";

// Left-sidebar shell for the whole customer-facing site (guest or logged
// in) — the "regular YouTube" half of the split whose other half is the
// store area's own sidebar (app/(store)/layout.tsx, "YouTube Studio").
// Structurally identical to that layout on purpose, so the two nav levels
// read as the same visual language.
export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const userId = await getCurrentUserId(supabase);
  const profile = userId ? await getById(supabase, userId) : null;

  return (
    <div className="mx-auto flex max-w-6xl flex-col sm:flex-row">
      <aside className="border-b px-3 py-3 sm:sticky sm:top-16 sm:h-[calc(100vh-4rem)] sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r sm:py-6">
        <SiteSidebar role={profile?.role ?? null} isLoggedIn={Boolean(userId)} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
