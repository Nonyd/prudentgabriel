import { create } from "zustand";
import type { ProductListItem } from "@/types/product";
import {
  initialQuickAddState,
  reduceQuickAdd,
  type QuickAddPhase,
  type QuickAddState,
} from "@/lib/quick-add";

interface QuickAddStore extends QuickAddState {
  open: (product: ProductListItem) => void;
  close: () => void;
  selectSize: (variantId: string) => void;
  submit: () => void;
  success: () => void;
  fail: (message: string) => void;
}

export const useQuickAddStore = create<QuickAddStore>((set) => ({
  ...initialQuickAddState(),
  open: (product) => set((s) => reduceQuickAdd(s, { type: "open", product })),
  close: () => set((s) => reduceQuickAdd(s, { type: "close" })),
  selectSize: (variantId) => set((s) => reduceQuickAdd(s, { type: "select", variantId })),
  submit: () => set((s) => reduceQuickAdd(s, { type: "submit" })),
  success: () => set((s) => reduceQuickAdd(s, { type: "success" })),
  fail: (message) => set((s) => reduceQuickAdd(s, { type: "fail", message })),
}));

export function isQuickAddOpen(phase: QuickAddPhase): boolean {
  return phase !== "idle";
}
