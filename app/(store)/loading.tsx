import { Leaf } from "lucide-react";

// Next.js route-segment loading UI (file convention) — shown automatically
// while any /dashboard* route/layout is still doing its async work
// (fetching the store, stats, etc.), so switching into "Studio mode" gets
// its own branded moment instead of a blank flash, per explicit feedback.
export default function StoreLoading() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
      <div className="relative flex size-16 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
        <span className="relative flex size-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Leaf className="size-8 animate-pulse" />
        </span>
      </div>
      <p className="text-sm font-medium text-muted-foreground">
        Đang tải khu vực quản lý cửa hàng...
      </p>
    </div>
  );
}
