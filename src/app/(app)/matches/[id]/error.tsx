"use client";

import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function MatchDetailError({
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
    <div className="flex flex-col items-center justify-center space-y-4 py-24 text-center">
      <div className="rounded-full bg-destructive/10 p-4">
        <AlertCircle className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold">Failed to load match</h2>
      <p className="max-w-md text-muted-foreground">
        This match could not be loaded. It may not exist, or there was an error fetching data from
        the Riot API.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <div className="flex gap-3">
        <Button onClick={() => unstable_retry()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Try Again
        </Button>
        <Link href="/matches">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Matches
          </Button>
        </Link>
      </div>
    </div>
  );
}
