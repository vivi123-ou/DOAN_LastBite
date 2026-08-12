"use client";

import { useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const ALL_TIME_OPTIONS = Array.from({ length: 24 * 4 }, (_, i) => {
  const hours = Math.floor(i / 4);
  const minutes = (i % 4) * 15;
  return `${pad(hours)}:${pad(minutes)}`;
});

interface TimeSelectProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  // "HH:mm" strings — when set, only options within [minTime, maxTime] are
  // offered. "HH:mm" sorts lexicographically the same as chronologically,
  // so plain string comparison is enough.
  minTime?: string;
  maxTime?: string;
}

// Always renders 24-hour "HH:mm" and never delegates to the browser's native
// <input type="time"> — that picker's AM/PM ("sáng"/"chiều") vs 24h display
// is tied to the OS locale, not something we can force from the page.
// Options step every 15 minutes: round-number suggestions (like Zalo/Google
// Calendar's picker), not free-typed second-level precision Best Before
// doesn't need.
export function TimeSelect({ id, value, onChange, minTime, maxTime }: TimeSelectProps) {
  const options = useMemo(
    () =>
      ALL_TIME_OPTIONS.filter(
        (t) => (!minTime || t >= minTime) && (!maxTime || t <= maxTime)
      ),
    [minTime, maxTime]
  );

  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v ?? "")}
      items={options.map((t) => ({ value: t, label: t }))}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Chọn giờ" />
      </SelectTrigger>
      <SelectContent className="max-h-64">
        {options.map((t) => (
          <SelectItem key={t} value={t}>
            {t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
