import { Skeleton } from "@/components/ui/Skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden bg-ivory-dark">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
    </div>
  );
}
