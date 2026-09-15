"use client";

import { useEffect } from "react";
import { useRecentlyViewedStore } from "@/store/recentlyViewedStore";
import { sendProductView } from "@/components/analytics/PageBeacon";

export function ViewTracker({ productId }: { productId: string }) {
  const add = useRecentlyViewedStore((s) => s.addViewed);
  useEffect(() => {
    add(productId);
    sendProductView(productId);
  }, [add, productId]);
  return null;
}
