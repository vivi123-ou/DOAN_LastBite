// Shared shape for every admin list page's real server-side pagination
// (see admin.repository.ts / subscription.repository.ts / commission.repository.ts)
// — not admin-specific by nature, but this is the first place in the app
// that needed real page-N-of-M pagination rather than a single capped
// fetch, so it lives as its own small domain file rather than bolted onto
// lib/domain/admin.ts.
export interface PaginatedResult<T> {
  items: T[];
  totalCount: number;
}

export const ADMIN_PAGE_SIZE = 20;
