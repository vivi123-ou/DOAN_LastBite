"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  recordBannerImpressionAction,
  recordBannerClickAction,
} from "@/app/(customer)/_components/ad-tracking.actions";
import type { AdBooking } from "@/lib/domain/ad";

const AUTO_ADVANCE_MS = 6000;

// One banner at a time, fading between them — a different shape from
// combo-carousel.tsx's horizontal card row on purpose: a banner is one big
// wide image, not several small cards side by side, so a slideshow reads
// more naturally than a scroll row here.
export function HomeBannerCarousel({ banners }: { banners: AdBooking[] }) {
  const [index, setIndex] = useState(0);
  const recordedImpressions = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % banners.length), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  useEffect(() => {
    const current = banners[index];
    if (!current || recordedImpressions.current.has(current.id)) return;
    recordedImpressions.current.add(current.id);
    void recordBannerImpressionAction(current.id);
  }, [index, banners]);

  if (banners.length === 0) return null;
  const current = banners[index];

  return (
    <section className="space-y-2">
      <Link
        href={current.linkUrl || (current.comboId ? `/combos/${current.comboId}` : "#")}
        onClick={() => void recordBannerClickAction(current.id)}
        className="block overflow-hidden rounded-2xl border"
      >
        {current.bannerImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
          <img
            src={current.bannerImageUrl}
            alt={current.storeName}
            className="aspect-[3/1] w-full object-cover"
          />
        )}
      </Link>
      {banners.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {banners.map((b, i) => (
            <button
              key={b.id}
              type="button"
              aria-label={`Banner ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
