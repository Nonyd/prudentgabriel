import { create } from "zustand";
import { persist } from "zustand/middleware";

const MAX = 8;

interface RecentlyViewedStore {
  ids: string[];
  addViewed: (id: string) => void;
  clearViewed: () => void;
}

export const useRecentlyViewedStore = create<RecentlyViewedStore>()(
  persist(
    (set, get) => ({
      ids: [],
      addViewed: (id) => {
        const without = get().ids.filter((x) => x !== id);
        const next = [id, ...without].slice(0, MAX);
        set({ ids: next });
      },
      clearViewed: () => set({ ids: [] }),
    }),
    { name: "pa-recently-viewed" },
  ),
);
