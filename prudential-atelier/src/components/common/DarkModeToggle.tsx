"use client";

import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** @deprecated Use ThemeToggle from `@/components/ui/ThemeToggle` */
export function DarkModeToggle() {
  return <ThemeToggle className="relative flex h-8 w-8 items-center justify-center transition-colors duration-200" />;
}
