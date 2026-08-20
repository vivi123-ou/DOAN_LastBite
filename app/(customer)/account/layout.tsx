import type { ReactNode } from "react";
import { AccountSidebar } from "@/app/(customer)/account/_components/account-sidebar";

// Left-sidebar shell for the account area, same structural pattern as
// app/(store)/layout.tsx. "Lịch sử đơn hàng" links out to the existing
// /orders page rather than a route nested here (kept as its own top-level
// page, not duplicated) — but /orders/layout.tsx renders this exact same
// AccountSidebar independently, so the sidebar stays visible across both
// without /orders needing to physically live under this folder.
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col sm:flex-row">
      <aside className="border-b px-3 py-3 sm:sticky sm:top-16 sm:h-[calc(100vh-4rem)] sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r sm:py-6">
        <AccountSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
