"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { mergeGuestLinesIntoServer } from "@/lib/cart-client";
import { useCartStore } from "@/store/cartStore";

export function CartSyncProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;

    let cancelled = false;

    (async () => {
      const local = useCartStore.getState().items;
      await mergeGuestLinesIntoServer(local);
      if (cancelled) return;
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return <>{children}</>;
}
