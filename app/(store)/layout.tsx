import type { ReactNode } from "react";
import { StoreSidebar } from "@/app/(store)/_components/store-sidebar";

// Left-sidebar shell for the whole store area — the YouTube Studio-style
// "different mode" signal (see StoreSidebar's own "Về trang người dùng"
// exit link for the other half of that signal — getting *out* of Studio
// mode). Sticky under the h-16 site header on sm+; collapses to a plain
// horizontal row above the content on mobile.
// Individual dashboard pages keep their own max-w/padding wrapper — this
// layout only adds the sidebar alongside them.
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-6xl flex-col sm:flex-row">
      <aside className="border-b px-3 py-3 sm:sticky sm:top-16 sm:h-[calc(100vh-4rem)] sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r sm:py-6">
        <StoreSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
