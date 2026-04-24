import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-gradient-to-r from-ivory-dark via-border to-ivory-dark",
        "animate-shimmer bg-[length:200%_100%]",
        className,
      )}
    />
  );
}
