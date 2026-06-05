"use client";

import { createContext, useContext } from "react";
import type { LogoSettings } from "@/lib/logos";

const EMPTY_LOGOS: LogoSettings = {
  logoDark: "",
  logoWhite: "",
  atelier: { dark: "", white: "" },
  bridal: { dark: "", white: "" },
  kids: { dark: "", white: "" },
};

const LogoContext = createContext<LogoSettings>(EMPTY_LOGOS);

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
