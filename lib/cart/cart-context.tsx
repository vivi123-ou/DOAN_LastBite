"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/domain/order";

const STORAGE_KEY = "lastbite:cart";

interface CartContextValue {
  items: CartItem[];
  storeId: string | null;
  storeName: string | null;
  subtotal: number;
  itemCount: number;
  // No conflict-handling built in here — a cart only ever holds one store's
  // items (matches orders.store_id being singular). The caller (see
  // components/cart/add-to-cart-button.tsx) checks `storeId` against the
  // combo being added and prompts to clear() first if they differ.
  addItem: (item: CartItem) => void;
  updateQuantity: (comboId: string, quantity: number) => void;
  removeItem: (comboId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Read localStorage only after mount — never during render — so server
  // and first-client render both start from an empty cart (no hydration
  // mismatch), then sync in from storage right after. A useState lazy
  // initializer can't do this instead: it still runs during hydration
  // (client-side, window defined) while the server rendered with `[]`,
  // producing the exact same mismatch this effect exists to avoid.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Syncing from an external store (localStorage) on mount, not
      // deriving state from props/state — the documented exception to this
      // rule (see the block comment above for why a lazy useState
      // initializer can't be used instead).
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setItems(JSON.parse(raw));
    } catch {
      // Corrupt/unavailable storage — start with an empty cart.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.comboId === item.comboId);
      if (existing) {
        return prev.map((i) =>
          i.comboId === item.comboId ? { ...i, quantity: i.quantity + item.quantity } : i
        );
      }
      return [...prev, item];
    });
  }, []);

  const updateQuantity = useCallback((comboId: string, quantity: number) => {
    setItems((prev) =>
      quantity <= 0
        ? prev.filter((i) => i.comboId !== comboId)
        : prev.map((i) => (i.comboId === comboId ? { ...i, quantity } : i))
    );
  }, []);

  const removeItem = useCallback((comboId: string) => {
    setItems((prev) => prev.filter((i) => i.comboId !== comboId));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      storeId: items[0]?.storeId ?? null,
      storeName: items[0]?.storeName ?? null,
      subtotal: items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      addItem,
      updateQuantity,
      removeItem,
      clear,
    }),
    [items, addItem, updateQuantity, removeItem, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
