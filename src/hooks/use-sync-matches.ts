"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SyncProgress {
  current: number;
  total: number;
  synced: number;
  failed: number;
  message: string;
}

export function useSyncMatches() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const router = useRouter();
  const toastIdRef = useRef<string | number | undefined>(undefined);

  const handleSync = useCallback(() => {
    if (isSyncing) return;

    setIsSyncing(true);
    setProgress(null);

    toastIdRef.current = toast.loading("Starting sync...");

    const eventSource = new EventSource("/api/sync");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case "status":
            toast.loading(data.message, { id: toastIdRef.current });
            break;

          case "progress": {
            const pct = Math.round((data.current / data.total) * 100);
            setProgress({
              current: data.current,
              total: data.total,
              synced: data.synced,
              failed: data.failed,
              message: data.message,
            });
            toast.loading(
              `${data.message} (${data.synced} synced, ${pct}%)`,
              { id: toastIdRef.current }
            );
            break;
          }

          case "done":
            eventSource.close();
            setIsSyncing(false);
            setProgress(null);
            if (data.synced > 0) {
              toast.success(data.message, { id: toastIdRef.current });
            } else {
              toast.info(data.message, { id: toastIdRef.current });
            }
            router.refresh();
            break;

          case "error":
            eventSource.close();
            setIsSyncing(false);
            setProgress(null);
            toast.error(data.message, { id: toastIdRef.current });
            break;
        }
      } catch {
        // Ignore parse errors
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      setIsSyncing(false);
      setProgress(null);
      toast.error("Connection lost during sync.", { id: toastIdRef.current });
    };
  }, [isSyncing, router]);

  return { isSyncing, progress, handleSync };
}
