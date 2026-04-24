import { Skeleton } from "@/components/ui/Skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="group block">
      <Skeleton className="aspect-[3/4] w-full rounded-sm" />
      <div className="space-y-2 py-3">
        <Skeleton className="h-4 w-[85%] max-w-[220px]" />
        <Skeleton className="h-4 w-1/3 max-w-[100px]" />
      </div>
    </div>
  );
}
