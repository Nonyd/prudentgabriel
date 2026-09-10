"use client";

import { createContext, useContext } from "react";
import { madeThenShippedCopy } from "@/lib/production-time";

const ProductionTimeContext = createContext(madeThenShippedCopy());

export function ProductionTimeProvider({
  copy,
  children,
}: {
  copy: string;
  children: React.ReactNode;
}) {
  return (
    <ProductionTimeContext.Provider value={madeThenShippedCopy(copy)}>
      {children}
    </ProductionTimeContext.Provider>
  );
}

export function useMadeThenShippedCopy(): string {
  return useContext(ProductionTimeContext);
}
