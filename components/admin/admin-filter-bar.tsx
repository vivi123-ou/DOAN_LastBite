interface SelectOption {
  value: string;
  label: string;
}

interface SelectFilter {
  name: string;
  defaultValue?: string;
  options: SelectOption[]; // first option should represent "no filter" (value="")
}

interface AdminFilterBarProps {
  searchPlaceholder: string;
  searchDefaultValue?: string;
  selects?: SelectFilter[];
  hasActiveFilter?: boolean;
}

// Plain server-rendered GET form — no client JS needed (native <select>/
// <input> + a submit button, the same shape already used for the date-range
// filter on /admin/commission). Every admin list page that can realistically
// grow long (stores, combos, users, reports, subscriptions, payouts) reuses
// this instead of each hand-rolling its own near-identical filter markup.
// Submitting reloads the current page with the new `?q=&status=...` params —
// the page's own Server Component reads them and passes them to the
// matching repository function, same URL-driven-filter-state pattern
// already established for the customer-facing search/price/sort filters.
export function AdminFilterBar({
  searchPlaceholder,
  searchDefaultValue,
  selects = [],
  hasActiveFilter,
}: AdminFilterBarProps) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        name="q"
        placeholder={searchPlaceholder}
        defaultValue={searchDefaultValue}
        className="min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm sm:max-w-xs"
      />
      {selects.map((s) => (
        <select
          key={s.name}
          name={s.name}
          defaultValue={s.defaultValue ?? ""}
          className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
        >
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}
      <button
        type="submit"
        className="rounded-md bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground"
      >
        Lọc
      </button>
      {hasActiveFilter && (
        <a href="?" className="text-sm text-muted-foreground underline underline-offset-2">
          Xoá lọc
        </a>
      )}
    </form>
  );
}
