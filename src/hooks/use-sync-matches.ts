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

    // Use fetch + ReadableStream instead of EventSource to avoid
    // spurious onerror firing when the server closes the stream.
    fetch("/api/sync")
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(
            res.ok ? "No response body" : `Sync failed (${res.status})`
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE format: "data: {...}\n\n"
          // Process all complete messages in the buffer
          const messages = buffer.split("\n\n");
          // Keep the last (possibly incomplete) chunk in the buffer
          buffer = messages.pop() || "";

          for (const msg of messages) {
            const dataLine = msg
              .split("\n")
              .find((line) => line.startsWith("data: "));
            if (!dataLine) continue;

            try {
              const data = JSON.parse(dataLine.slice(6));

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
                  if (data.synced > 0) {
                    toast.success(data.message, { id: toastIdRef.current });
                  } else {
                    toast.info(data.message, { id: toastIdRef.current });
                  }
                  router.refresh();
                  break;

                case "error":
                  toast.error(data.message, { id: toastIdRef.current });
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      })
      .catch((error) => {
        // Only fires on actual network errors (fetch failure, aborted, etc.)
        // NOT on clean server-side stream close.
        const message =
          error instanceof Error ? error.message : "Connection lost during sync.";
        toast.error(message, { id: toastIdRef.current });
      })
      .finally(() => {
        setIsSyncing(false);
        setProgress(null);
      });
  }, [isSyncing, router]);

  return { isSyncing, progress, handleSync };
}
