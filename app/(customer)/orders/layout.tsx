import type { ReactNode } from "react";
import { AccountSidebar } from "@/app/(customer)/account/_components/account-sidebar";

// /orders isn't nested under /account (it's the pre-existing phase-2 order
// history page, deliberately not duplicated — see CLAUDE.md), but it's
// still one of the account area's tabs ("Lịch sử đơn hàng"), so it gets its
// own copy of the exact same sidebar shell as account/layout.tsx. Without
// this, navigating here from another account tab made the left nav vanish
// (this route wasn't wrapped by anything providing it) while every other
// tab kept it — same AccountSidebar component, so the active-tab highlight
// stays correct automatically. Wraps /orders and /orders/[id] both.
export default function OrdersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex max-w-4xl flex-col sm:flex-row">
      <aside className="border-b px-3 py-3 sm:sticky sm:top-16 sm:h-[calc(100vh-4rem)] sm:w-56 sm:shrink-0 sm:border-b-0 sm:border-r sm:py-6">
        <AccountSidebar />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
