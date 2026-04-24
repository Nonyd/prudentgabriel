"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
  srLabel: string;
}

const track = { sm: { w: 36, h: 20, thumb: 14, travel: 18 }, md: { w: 44, h: 24, thumb: 18, travel: 22 } };

export function Toggle({ checked, onChange, disabled, size = "md", label, srLabel }: ToggleProps) {
  const t = track[size];
  return (
    <div className={cn("inline-flex items-center gap-3", label ? "" : "")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative shrink-0 rounded-full transition-colors duration-200",
          size === "sm" ? "h-5 w-9" : "h-6 w-11",
          checked ? "bg-[var(--wine)]" : "bg-[var(--border)]",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        )}
      >
        <span className="sr-only">{srLabel}</span>
        <motion.span
          className={cn("absolute top-[2px] block rounded-full bg-white shadow-sm", size === "sm" ? "h-3.5 w-3.5" : "h-[18px] w-[18px]")}
          initial={false}
          animate={{ x: checked ? t.travel : 2 }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      {label ? <span className="font-body text-sm text-ivory/90">{label}</span> : null}
    </div>
  );
}
