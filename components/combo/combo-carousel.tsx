"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ComboCard } from "@/components/combo/combo-card";
import type { NearbyCombo } from "@/lib/domain/combo";

const AUTO_ADVANCE_MS = 5000;

// A titled horizontal row (inbook.vn's "Bestsellers"/"New arrivals" rhythm,
// .claude/rules/workflow.md) — roughly 4 cards visible on desktop, arrow
// buttons that only appear once there's actually more to scroll to, and a
// slow auto-advance loop when there's enough content to make it worthwhile.
// No per-card `tag` is passed here on purpose — the row's own <h2> title
// already says what this shelf is, so repeating it on every card under it
// would just be redundant (explicit feedback: a "Mới nhất" tag showing up
// again on a card already sitting under a "Mới nhất" heading read as a
// rendering bug at first glance).
export function ComboCarousel({
  title,
  combos,
  emptyMessage,
  viewerStoreId,
}: {
  title: string;
  combos: NearbyCombo[];
  emptyMessage?: string;
  viewerStoreId?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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
  // runs when there's real overflow to show off — a short list just sits
  // still, no pointless empty scrolling.
  useEffect(() => {
    if (!canScrollRight && !canScrollLeft) return;
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
  }, [canScrollRight, canScrollLeft]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold sm:text-2xl">{title}</h2>
        {(canScrollLeft || canScrollRight) && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => scrollByPage(-1)}
              disabled={!canScrollLeft}
              aria-label="Xem trước"
              className="flex size-8 items-center justify-center rounded-full border transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollByPage(1)}
              disabled={!canScrollRight}
              aria-label="Xem tiếp"
              className="flex size-8 items-center justify-center rounded-full border transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {combos.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          {emptyMessage ?? "Chưa có combo nào ở đây lúc này. Hãy quay lại sau nhé!"}
        </p>
      ) : (
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
              <ComboCard combo={combo} viewerStoreId={viewerStoreId} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
