"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  rating: number;
  size?: "sm" | "md";
  interactive?: boolean;
  onChange?: (r: number) => void;
  className?: string;
}

const sizeMap = { sm: "h-3.5 w-3.5 gap-0.5", md: "h-5 w-5 gap-1" };

export function StarRating({
  rating,
  size = "md",
  interactive,
  onChange,
  className,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const display = interactive ? hover || rating : rating;

  return (
    <div
      className={cn("inline-flex items-center", sizeMap[size], className)}
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
              "relative text-gold",
              interactive &&
                "cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold",
              !interactive && "pointer-events-none",
            )}
            aria-label={`${i} stars`}
          >
            <span className={cn("text-ivory-dark/40", filled && "text-gold")}>★</span>
            {half && (
              <span className="absolute inset-0 w-1/2 overflow-hidden text-gold" aria-hidden>
                ★
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
