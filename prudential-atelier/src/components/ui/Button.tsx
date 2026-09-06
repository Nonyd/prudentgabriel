"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "ghost-dark" | "ghost-light" | "danger" | "secondary" | "ghost" | "gold";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-transparent bg-[var(--choc-deep)] text-[var(--ivory-deep)] hover:opacity-90",
  "ghost-dark": "border border-lightbr bg-transparent text-cream hover:bg-lightbr/10",
  "ghost-light": "border border-nut bg-transparent text-nut hover:bg-nut/5",
  danger: "border border-danger bg-danger text-cream hover:opacity-90",
  secondary: "border border-nut bg-transparent text-nut hover:bg-nut/5",
  ghost: "border border-transparent bg-transparent text-text-dark hover:text-nut",
  gold: "border border-lightbr bg-lightbr text-cream hover:bg-nut",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-[9px] tracking-[0.14em]",
  md: "px-7 py-[13px] text-[10px] tracking-[0.16em]",
  lg: "px-8 py-4 text-[11px] tracking-[0.16em]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, disabled, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-2 font-sans font-semibold uppercase transition-[color,background-color,transform,opacity] duration-200",
          "active:scale-[0.97]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lightbr focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
          "rounded-full",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            <span className="sr-only">Please wait</span>
          </>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
