"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImageOff, MapPin, Store as StoreIcon, X } from "lucide-react";
import type { Store } from "@/lib/domain/store";
import type { StoreComboSummary } from "@/lib/domain/combo";

interface StoreDetailPanelProps {
  storeId: string;
  onClose: () => void;
}

// Google Maps-style place card: opens on the left when a store marker is
// clicked (map-view.tsx), replacing the old small Leaflet Popup. Combos
// load a page at a time via an IntersectionObserver sentinel at the bottom
// of the scrollable list ("kéo tới đâu hiển thị tới đó, không hiển thị ra
// liền hết để đảm bảo ko bị lag") rather than fetching the store's entire
// catalog up front.
export function StoreDetailPanel({ storeId, onClose }: StoreDetailPanelProps) {
  const [store, setStore] = useState<Store | null>(null);
  const [combos, setCombos] = useState<StoreComboSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingStore, setLoadingStore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingMoreRef = useRef(false);

  // Loads once on mount — the parent (map-view.tsx) remounts this
  // component with a fresh `key={storeId}` per selected store, so there's
  // no need to manually reset state here on a storeId change (which would
  // mean synchronous setState calls at the top of an effect body).
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch(`/api/stores/${storeId}`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/api/stores/${storeId}/combos`).then((r) => (r.ok ? r.json() : null)),
    ]).then(([storeRes, combosRes]) => {
      if (cancelled) return;
      setStore(storeRes?.store ?? null);
      setCombos(combosRes?.combos ?? []);
      setHasMore(combosRes?.hasMore ?? false);
      setLoadingStore(false);
    });

    return () => {
      cancelled = true;
    };
  }, [storeId]);

  async function loadMore() {
    if (loadingMoreRef.current || !hasMore) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const res = await fetch(`/api/stores/${storeId}/combos?offset=${combos.length}`);
    if (res.ok) {
      const data = await res.json();
      setCombos((prev) => [...prev, ...data.combos]);
      setHasMore(data.hasMore);
    }
    loadingMoreRef.current = false;
    setLoadingMore(false);
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadMore closes over combos.length/hasMore intentionally; re-subscribing per combos change is the point (so the sentinel always has the latest offset)
  }, [combos.length, hasMore]);

  return (
    <div className="absolute inset-y-0 left-0 z-[1000] flex w-full max-w-sm flex-col bg-background shadow-xl sm:m-2 sm:rounded-lg">
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full bg-background/90 shadow hover:bg-muted"
      >
        <X className="size-4" />
      </button>

      {loadingStore ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Đang tải...
        </div>
      ) : !store ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Không tải được thông tin cửa hàng.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="relative aspect-video w-full shrink-0 bg-muted">
            {store.bannerUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
              <img src={store.bannerUrl} alt={store.name} className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-muted-foreground">
                <StoreIcon className="size-10" />
              </div>
            )}
          </div>

          <div className="space-y-3 p-4">
            <div>
              <h2 className="text-lg font-bold">{store.name}</h2>
              <p className="flex items-start gap-1.5 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                {store.addressLine}
              </p>
            </div>
            {store.description && <p className="text-sm text-muted-foreground">{store.description}</p>}

            <div className="border-t pt-3">
              <h3 className="mb-2 text-sm font-semibold">Combo đang bán</h3>
              {combos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Cửa hàng chưa có combo nào đang bán.</p>
              ) : (
                <ul className="space-y-2">
                  {combos.map((combo) => (
                    <li key={combo.comboId}>
                      <Link
                        href={`/combos/${combo.comboId}`}
                        className="flex items-center gap-3 rounded-md p-1.5 hover:bg-muted"
                      >
                        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                          {combo.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL
                            <img src={combo.imageUrl} alt="" className="size-full object-cover" />
                          ) : (
                            <ImageOff className="size-4 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{combo.name}</p>
                          <p className="text-sm font-semibold text-primary">
                            {combo.currentPrice.toLocaleString("vi-VN")}đ
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {hasMore && (
                <div ref={sentinelRef} className="py-3 text-center text-xs text-muted-foreground">
                  {loadingMore ? "Đang tải thêm..." : ""}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
