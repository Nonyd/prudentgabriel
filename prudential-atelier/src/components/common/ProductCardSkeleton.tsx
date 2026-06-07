import { Skeleton } from "@/components/ui/Skeleton";

export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden border border-sand/70 bg-bg-card">
      <Skeleton className="aspect-[3/4] w-full rounded-none" />
      <div className="space-y-2.5 px-4 py-4 md:px-5 md:py-5">
        <Skeleton className="h-4 w-[85%] max-w-[220px]" />
        <Skeleton className="h-3.5 w-1/3 max-w-[100px]" />
        <div className="flex gap-2 pt-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-3.5 w-3.5 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
