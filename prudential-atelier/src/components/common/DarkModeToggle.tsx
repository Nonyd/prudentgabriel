"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store/themeStore";

export function DarkModeToggle() {
  const { isDark, toggle } = useThemeStore();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-8 w-8 items-center justify-center text-charcoal transition-colors duration-200 hover:text-olive"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDark ? "moon" : "sun"}
          initial={{ opacity: 0, rotate: -90, scale: 0.8 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.8 }}
          transition={{ duration: 0.2 }}
        >
          {isDark ? (
            <Sun size={17} strokeWidth={1.5} />
          ) : (
            <Moon size={17} strokeWidth={1.5} />
          )}
        </motion.div>
      </AnimatePresence>
    </button>
  );
}
