"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComboCard } from "@/components/combo/combo-card";
import type { NearbyCombo } from "@/lib/domain/combo";

const AUTO_ADVANCE_MS = 5000;

// A titled horizontal row (inbook.vn's "Bestsellers"/"New arrivals" rhythm,
// .claude/rules/workflow.md) — roughly 4 cards visible on desktop, arrow
// buttons anchored at the row's own left/right edges (overlaying the card
// track, not tucked into the header) so they're where a hand already is
// when dragging through the row, and only shown once there's actually
// somewhere to scroll to. Auto-advance pauses on hover — it used to keep
// sliding out from under a customer who was mid-look at a card, before they
// could even click it. No per-card `tag` is passed here on purpose — the
// row's own <h2> title already says what this shelf is, so repeating it on
// every card under it would just be redundant (explicit feedback: a "Mới
// nhất" tag showing up again on a card already sitting under a "Mới nhất"
// heading read as a rendering bug at first glance).
export function ComboCarousel({
  title,
  combos,
  emptyMessage,
  viewerStoreId,
  isAdmin,
  viewAllHref,
}: {
  title: string;
  combos: NearbyCombo[];
  emptyMessage?: string;
  viewerStoreId?: string;
  isAdmin?: boolean;
  // Optional "Xem tất cả" link next to the title — omitted for rows with no
  // natural "see everything in this shelf" destination (e.g. "Gợi ý cho
  // bạn", which isn't a real filterable category).
  viewAllHref?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [paused, setPaused] = useState(false);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [combos]);

  function scrollByPage(direction: 1 | -1) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: "smooth" });
  }

  // Auto-advance, looping back to the start once the end is reached. Only
  // runs when there's real overflow to show off, and pauses entirely while
  // the pointer is over the row — a customer hovering a card to read it (or
  // reach for the arrow) shouldn't have the row slide away underneath them.
  useEffect(() => {
    if (paused || (!canScrollRight && !canScrollLeft)) return;
    const interval = setInterval(() => {
      const el = scrollRef.current;
      if (!el) return;
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
      if (atEnd) {
        el.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        el.scrollBy({ left: el.clientWidth * 0.9, behavior: "smooth" });
      }
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(interval);
  }, [canScrollRight, canScrollLeft, paused]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        {viewAllHref && (
          <Link href={viewAllHref} className="text-sm font-medium text-primary hover:underline">
            Xem tất cả →
          </Link>
        )}
      </div>

      {combos.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {emptyMessage ?? "Chưa có combo nào ở đây lúc này. Hãy quay lại sau nhé!"}
        </p>
      ) : (
        <div
          className="relative"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {canScrollLeft && (
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              aria-label="Xem trước"
              className="absolute left-0 top-1/2 z-10 flex size-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-md transition-colors hover:border-primary hover:text-primary"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              aria-label="Xem tiếp"
              className="absolute right-0 top-1/2 z-10 flex size-9 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border bg-background shadow-md transition-colors hover:border-primary hover:text-primary"
            >
              <ChevronRight className="size-4" />
            </button>
          )}
          <div
            ref={scrollRef}
            onScroll={updateArrows}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {combos.map((combo) => (
              <div
                key={combo.comboId}
                className="w-[68%] shrink-0 snap-start sm:w-[44%] md:w-[31%] lg:w-[23%]"
              >
                <ComboCard combo={combo} viewerStoreId={viewerStoreId} isAdmin={isAdmin} />
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
