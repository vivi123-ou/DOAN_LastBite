import type { ReactNode } from "react";
import { StoreNav } from "@/app/(store)/_components/store-nav";

// Deliberately doesn't wrap {children} in its own max-w/padding container —
// each page under (store) already has one (matching the rest of the app's
// per-page container convention) — this just adds the shared tab nav above.
export default function StoreLayout({ children }: { children: ReactNode }) {
  return (
    <div>
      <div className="border-b">
        <div className="mx-auto max-w-3xl px-4">
          <StoreNav />
        </div>
      </div>
      {children}
    </div>
  );
}
