"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/ui/ThemeProvider";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme, mounted } = useTheme();

  if (!mounted) {
    return (
      <button
        type="button"
        className={className}
        aria-label="Toggle theme"
        style={{ color: "var(--text-mid)" }}
      >
        <Sun size={20} strokeWidth={1.5} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={className}
      aria-label={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
      style={{ color: "var(--text-mid)" }}
    >
      {theme === "light" ? (
        <Moon size={20} strokeWidth={1.5} />
      ) : (
        <Sun size={20} strokeWidth={1.5} />
      )}
    </button>
  );
}
