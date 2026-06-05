"use client";

import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  label?: string;
  srLabel: string;
  className?: string;
  checkedClassName?: string;
  uncheckedClassName?: string;
  labelClassName?: string;
}

const sizeStyles = {
  sm: {
    track: "h-5 w-9",
    thumb: "h-3.5 w-3.5",
    checked: "translate-x-[18px]",
  },
  md: {
    track: "h-6 w-11",
    thumb: "h-5 w-5",
    checked: "translate-x-5",
  },
} as const;

export function Toggle({
  checked,
  onChange,
  disabled,
  size = "md",
  label,
  srLabel,
  className,
  checkedClassName = "bg-choc",
  uncheckedClassName = "bg-sand",
  labelClassName,
}: ToggleProps) {
  const s = sizeStyles[size];

  return (
    <div className={cn("inline-flex items-center gap-3", label ? "" : "")}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={srLabel}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={cn(
          "relative inline-flex shrink-0 cursor-pointer overflow-hidden rounded-full transition-colors duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-choc/40 focus-visible:ring-offset-2",
          s.track,
          checked ? checkedClassName : uncheckedClassName,
          disabled && "cursor-not-allowed opacity-40",
          className,
        )}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-0.5 top-0.5 block rounded-full bg-white shadow-sm",
            "transition-transform duration-200 ease-out",
            s.thumb,
            checked ? s.checked : "translate-x-0",
          )}
        />
      </button>
      {label ? (
        <span className={cn("font-body text-sm text-text-mid", labelClassName)}>{label}</span>
      ) : null}
    </div>
  );
}
