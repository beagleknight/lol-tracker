import { Skeleton } from "@/components/ui/skeleton";

export default function ActionItemsLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-36" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-[150px]" />
        <Skeleton className="h-9 w-[180px]" />
      </div>

      {/* Action items */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg border border-border/50 bg-surface-elevated p-3"
          >
            <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-full max-w-md" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
            <Skeleton className="h-5 w-20 shrink-0 rounded-full" />
            <Skeleton className="h-7 w-7 shrink-0 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
