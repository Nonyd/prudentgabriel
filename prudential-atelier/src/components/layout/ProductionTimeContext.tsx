"use client";

import { createContext, useContext } from "react";
import { fabricPolicyCopy, madeThenShippedCopy } from "@/lib/production-time";
import { DEFAULT_FABRIC_PROMISE_HOURS } from "@/lib/fabric-unavailable";

const ProductionTimeContext = createContext(madeThenShippedCopy());
const FabricPolicyContext = createContext(fabricPolicyCopy(DEFAULT_FABRIC_PROMISE_HOURS));

export function ProductionTimeProvider({
  copy,
  fabricPromiseHours = DEFAULT_FABRIC_PROMISE_HOURS,
  children,
}: {
  copy: string;
  fabricPromiseHours?: number;
  children: React.ReactNode;
}) {
  return (
    <ProductionTimeContext.Provider value={madeThenShippedCopy(copy)}>
      <FabricPolicyContext.Provider value={fabricPolicyCopy(fabricPromiseHours)}>{children}</FabricPolicyContext.Provider>
    </ProductionTimeContext.Provider>
  );
}

export function useMadeThenShippedCopy(): string {
  return useContext(ProductionTimeContext);
}

/** AR5: fabric promise from the live `fabric_promise_hours` setting. */
export function useFabricPolicyCopy(): string {
  return useContext(FabricPolicyContext);
}
