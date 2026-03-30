import { Skeleton } from "@/components/ui/skeleton";

export default function ScoutLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>

      {/* Controls row */}
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <Skeleton className="h-9 flex-1 sm:max-w-xs" />
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Placeholder content area */}
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16">
        <Skeleton className="mb-3 h-10 w-10 rounded-full" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="mt-2 h-3 w-56" />
      </div>
    </div>
  );
}
