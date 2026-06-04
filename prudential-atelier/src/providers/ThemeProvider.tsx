"use client";

import { ThemeProvider } from "@/components/ui/ThemeProvider";

export { ThemeProvider, useTheme } from "@/components/ui/ThemeProvider";

/** @deprecated Import from `@/components/ui/ThemeProvider` */
export function LegacyThemeProvider({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
