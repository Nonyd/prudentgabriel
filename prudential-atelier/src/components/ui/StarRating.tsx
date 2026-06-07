"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md" | "lg";
  variant?: "olive" | "gold";
  interactive?: boolean;
  onChange?: (r: number) => void;
  className?: string;
}

const containerSizeMap = {
  sm: "gap-0.5",
  md: "gap-1",
  lg: "gap-1.5",
};

const starSizeMap = {
  sm: "h-3.5 w-3.5 text-[14px]",
  md: "h-8 w-8 text-[32px]",
  lg: "h-9 w-9 text-[36px]",
};

export function StarRating({
  rating,
  size = "md",
  variant = "olive",
  interactive,
  onChange,
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const display = interactive ? hover || rating : rating;
  const filledClass = variant === "gold" ? "text-[#C9A84C]" : "text-olive";
  const emptyClass = variant === "gold" ? "text-sand" : "text-mid-grey";

  return (
    <div
      className={cn("inline-flex shrink-0 items-center", containerSizeMap[size], className)}
      role={interactive ? "radiogroup" : undefined}
      onMouseLeave={interactive ? () => setHover(0) : undefined}
    >
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = display >= i;
        const half = !filled && display >= i - 0.5;
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={interactive ? () => onChange?.(i) : undefined}
            onMouseEnter={interactive ? () => setHover(i) : undefined}
            className={cn(
              "relative inline-flex shrink-0 items-center justify-center leading-none",
              starSizeMap[size],
              emptyClass,
              interactive &&
                "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-olive",
              !interactive && "pointer-events-none",
            )}
            aria-label={`${i} stars`}
          >
            <span className={cn(filled && filledClass)}>★</span>
            {half && (
              <span className={cn("absolute inset-0 w-1/2 overflow-hidden", filledClass)} aria-hidden>
                ★
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
