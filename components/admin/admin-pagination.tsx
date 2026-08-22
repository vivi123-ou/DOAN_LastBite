interface AdminPaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  // The page's own already-parsed searchParams (q/status/role/...) — needed
  // so the Trước/Sau links preserve whatever search/filter is active
  // instead of resetting it when moving between pages.
  searchParams: Record<string, string | undefined>;
}

// Plain server-rendered links (no client JS) — same "no interactivity
// needed for a GET-driven filter" posture as AdminFilterBar. Renders
// nothing when everything already fits on one page, so it never shows up
// as empty chrome on a short list.
export function AdminPagination({ page, pageSize, totalCount, searchParams }: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalPages <= 1) return null;

  function hrefFor(targetPage: number): string {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (key !== "page" && value) params.set(key, value);
    }
    params.set("page", String(targetPage));
    return `?${params.toString()}`;
  }

  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
      <p className="text-muted-foreground">
        Trang {page}/{totalPages} · {totalCount.toLocaleString("vi-VN")} kết quả
      </p>
      <div className="flex gap-2">
        <a
          href={hasPrev ? hrefFor(page - 1) : undefined}
          aria-disabled={!hasPrev}
          className={`rounded-md border px-3 py-1.5 ${
            hasPrev ? "hover:bg-muted" : "pointer-events-none opacity-40"
          }`}
        >
          Trước
        </a>
        <a
          href={hasNext ? hrefFor(page + 1) : undefined}
          aria-disabled={!hasNext}
          className={`rounded-md border px-3 py-1.5 ${
            hasNext ? "hover:bg-muted" : "pointer-events-none opacity-40"
          }`}
        >
          Sau
        </a>
      </div>
    </div>
  );
}
