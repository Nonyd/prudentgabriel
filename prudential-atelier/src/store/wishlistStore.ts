import { create } from "zustand";
import { persist } from "zustand/middleware";

interface WishlistStore {
  ids: string[];
  addToWishlist: (id: string) => void;
  removeFromWishlist: (id: string) => void;
  toggleWishlist: (id: string) => void;
  isInWishlist: (id: string) => boolean;
  clearWishlist: () => void;
  setIds: (ids: string[]) => void;
}

export const useWishlistStore = create<WishlistStore>()(
  persist(
    (set, get) => ({
      ids: [],
      addToWishlist: (id) => {
        const { ids } = get();
        if (ids.includes(id)) return;
        set({ ids: [...ids, id] });
      },
      removeFromWishlist: (id) => set({ ids: get().ids.filter((x) => x !== id) }),
      toggleWishlist: (id) => {
        if (get().isInWishlist(id)) get().removeFromWishlist(id);
        else get().addToWishlist(id);
      },
      isInWishlist: (id) => get().ids.includes(id),
      clearWishlist: () => set({ ids: [] }),
      setIds: (ids) => set({ ids }),
    }),
    { name: "pa-wishlist" },
  ),
);
