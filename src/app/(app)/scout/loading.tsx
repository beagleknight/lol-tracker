import { Skeleton } from "@/components/ui/skeleton";

export default function ScoutLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Skeleton className="h-9 flex-1 sm:max-w-xs" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Placeholder content area */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Skeleton className="h-10 w-10 rounded-full mb-3" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-3 w-56 mt-2" />
      </div>
    </div>
  );
}
