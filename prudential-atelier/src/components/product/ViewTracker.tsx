"use client";

import { useEffect } from "react";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";

export function ViewTracker({ productId }: { productId: string }) {
  const add = useRecentlyViewedStore((s) => s.addViewed);
  useEffect(() => {
    add(productId);
  }, [add, productId]);
  return null;
}
