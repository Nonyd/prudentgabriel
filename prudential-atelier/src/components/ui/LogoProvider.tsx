"use client";

import { createContext, useContext } from "react";
import type { LogoSettings } from "@/lib/logos";

const LogoContext = createContext<LogoSettings>({ logoDark: "", logoWhite: "" });

export function LogoProvider({
  logos,
  children,
}: {
  logos: LogoSettings;
  children: React.ReactNode;
}) {
  return <LogoContext.Provider value={logos}>{children}</LogoContext.Provider>;
}

export function useLogoSettings(): LogoSettings {
  return useContext(LogoContext);
}
