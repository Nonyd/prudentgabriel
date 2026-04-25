"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "gold" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-olive bg-olive text-white hover:border-olive-hover hover:bg-olive-hover",
  secondary:
    "border border-ink bg-transparent text-ink hover:bg-ink hover:text-[#ffffff]",
  ghost: "border border-transparent bg-transparent text-ink hover:border-ink hover:text-olive",
  gold: "border border-bride-accent bg-bride-accent text-bride-dark hover:opacity-90",
  danger: "border border-error bg-error text-white hover:opacity-90",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[11px] tracking-[0.12em]",
  md: "px-6 py-3 text-[12px] tracking-[0.12em]",
  lg: "px-8 py-4 text-[13px] tracking-[0.14em]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "relative inline-flex items-center justify-center gap-2",
          "font-body font-medium uppercase tracking-[0.12em] transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "overflow-hidden",
          "before:absolute before:inset-0 before:-translate-x-full",
          "before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
          "before:transition-transform before:duration-500 hover:before:translate-x-full",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
