import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Lightweight skeleton placeholder for the sidebar.
 * Rendered as the Suspense fallback while user data loads on slow networks.
 * Mirrors the visual structure of AppSidebar / SidebarContent.
 */
export function AppSidebarSkeleton() {
  return (
    <aside className="fixed top-0 left-0 z-40 hidden h-screen w-64 border-r border-border/50 bg-card md:block">
      <div className="flex h-full flex-col">
        {/* Logo + sync button */}
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded" />
            <Skeleton className="h-4 w-20" />
          </div>
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <Separator />

        {/* Season filter */}
        <div className="px-3 pt-2 pb-1">
          <Skeleton className="h-9 w-full rounded-md" />
        </div>
        <Separator />

        {/* Nav sections */}
        <div className="flex-1 px-3 py-4">
          {/* Dashboard */}
          <div className="space-y-1">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>

          {/* Tracker section */}
          <Skeleton className="mt-6 mb-2 ml-3 h-3 w-16" />
          <div className="space-y-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>

          {/* Insights section */}
          <Skeleton className="mt-6 mb-2 ml-3 h-3 w-16" />
          <div className="space-y-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>

          {/* Coaching section */}
          <Skeleton className="mt-6 mb-2 ml-3 h-3 w-20" />
          <div className="space-y-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>

          <Separator className="my-4" />

          {/* Bottom nav */}
          <div className="space-y-1">
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>

        {/* User menu */}
        <Separator />
        <div className="p-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
