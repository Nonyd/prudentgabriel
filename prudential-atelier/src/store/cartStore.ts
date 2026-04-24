import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantId: string;
  size: string;
  colorId?: string;
  color?: string;
  colorHex?: string;
  imageUrl: string;
  priceNGN: number;
  priceUSD: number;
  priceGBP: number;
  quantity: number;
  /** Variant stock at time of add — used for checkout qty cap */
  stock: number;
  /** ProductCategory enum string — coupon scope */
  category?: string;
}

interface CartStore {
  items: CartItem[];
  isOpen: boolean;
  isSearchOpen: boolean;
  totalItems: number;
  totalNGN: number;

  openCart: () => void;
  closeCart: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
  updateQty: (id: string, qty: number) => void;
  clearCart: () => void;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,
      isSearchOpen: false,
      totalItems: 0,
      totalNGN: 0,

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      openSearch: () => set({ isSearchOpen: true }),
      closeSearch: () => set({ isSearchOpen: false }),

      addItem: (item) => {
        const { items } = get();
        const existing = items.find((i) => i.id === item.id);
        let newItems: CartItem[];

        if (existing) {
          newItems = items.map((i) =>
            i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i,
          );
        } else {
          newItems = [...items, item];
        }

        set({
          items: newItems,
          totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
          totalNGN: newItems.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0),
          isOpen: true,
        });
      },

      removeItem: (id) => {
        const newItems = get().items.filter((i) => i.id !== id);
        set({
          items: newItems,
          totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
          totalNGN: newItems.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0),
        });
      },

      updateQty: (id, qty) => {
        if (qty < 1) {
          get().removeItem(id);
          return;
        }
        const newItems = get().items.map((i) => (i.id === id ? { ...i, quantity: qty } : i));
        set({
          items: newItems,
          totalItems: newItems.reduce((sum, i) => sum + i.quantity, 0),
          totalNGN: newItems.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0),
        });
      },

      clearCart: () => set({ items: [], totalItems: 0, totalNGN: 0 }),
    }),
    {
      name: "pa-cart",
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.items = state.items.map((i) => ({
            ...i,
            stock: typeof i.stock === "number" ? i.stock : 999,
          }));
          state.totalItems = state.items.reduce((sum, i) => sum + i.quantity, 0);
          state.totalNGN = state.items.reduce((sum, i) => sum + i.priceNGN * i.quantity, 0);
        }
      },
    },
  ),
);
