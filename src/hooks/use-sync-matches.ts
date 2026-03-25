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

    toastIdRef.current = toast.loading("Fetching latest matches...");

    // Use fetch + ReadableStream instead of EventSource to avoid
    // spurious onerror firing when the server closes the stream.
    fetch("/api/sync")
      .then(async (res) => {
        if (!res.ok || !res.body) {
          throw new Error(
            res.ok ? "No response body" : `Something went wrong while fetching matches. Please try again.`
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let receivedFinal = false;

        const processMessage = (msg: string) => {
          const dataLine = msg
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) return;

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
                  `${data.message} (${data.synced} imported, ${pct}%)`,
                  { id: toastIdRef.current }
                );
                break;
              }

              case "done":
                receivedFinal = true;
                if (data.synced > 0) {
                  toast.success(data.message, { id: toastIdRef.current, duration: 8000 });
                } else {
                  toast.info(data.message, { id: toastIdRef.current, duration: 8000 });
                }
                router.refresh();
                break;

              case "error":
                receivedFinal = true;
                toast.error(data.message, { id: toastIdRef.current, duration: 10000 });
                break;
            }
          } catch {
            // Ignore parse errors
          }
        };

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
            processMessage(msg);
          }
        }

        // Process any remaining data in the buffer after stream ends.
        // The final SSE message may not have a trailing \n\n before
        // the server closes the stream.
        if (buffer.trim()) {
          processMessage(buffer);
        }

        // If the stream ended without a done/error event, show a warning
        // (this shouldn't happen — indicates the server closed unexpectedly)
        if (!receivedFinal) {
          toast.warning("Update ended unexpectedly. Check if your matches are up to date.", {
            id: toastIdRef.current,
            duration: 8000,
          });
        }
      })
      .catch((error) => {
        // Only fires on actual network errors (fetch failure, aborted, etc.)
        // NOT on clean server-side stream close.
        const message =
          error instanceof Error ? error.message : "Connection lost while updating matches.";
        toast.error(message, { id: toastIdRef.current });
      })
      .finally(() => {
        setIsSyncing(false);
        setProgress(null);
      });
  }, [isSyncing, router]);

  return { isSyncing, progress, handleSync };
}
