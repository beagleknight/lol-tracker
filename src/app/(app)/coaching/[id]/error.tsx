"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";

export default function CoachingDetailError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">Failed to load coaching session</h2>
      <p className="text-muted-foreground max-w-md">
        This coaching session could not be loaded. It may have been deleted or
        an unexpected error occurred.
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground font-mono">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => unstable_retry()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Link href="/coaching">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Coaching
          </Button>
        </Link>
      </div>
    </div>
  );
}
