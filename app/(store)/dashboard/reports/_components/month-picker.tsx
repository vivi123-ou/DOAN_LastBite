"use client";

import { useRouter } from "next/navigation";

interface MonthPickerProps {
  year: number;
  month: number;
}

// Last 12 months back from today, newest first — plenty for a store that's
// only been running a few months, and bounded rather than an open-ended
// year input that could ask for a report on a month before the store even
// existed.
function lastTwelveMonths(): { year: number; month: number }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

export function MonthPicker({ year, month }: MonthPickerProps) {
  const router = useRouter();
  const options = lastTwelveMonths();

  return (
    <select
      value={`${year}-${month}`}
      onChange={(e) => {
        const [y, m] = e.target.value.split("-");
        router.push(`/dashboard/reports?year=${y}&month=${m}`);
      }}
      className="rounded-md border bg-background px-2.5 py-1.5 text-sm"
    >
      {options.map((o) => (
        <option key={`${o.year}-${o.month}`} value={`${o.year}-${o.month}`}>
          Tháng {o.month}/{o.year}
        </option>
      ))}
    </select>
  );
}
