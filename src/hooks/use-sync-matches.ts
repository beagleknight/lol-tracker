"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface SyncProgress {
  current: number;
  total: number;
  synced: number;
  failed: number;
  message: string;
}

interface SyncOptions {
  /** When true, skip the loading toast. Only show a toast if new matches are found. */
  silent?: boolean;
}

/** Stale threshold: auto-sync when tab regains focus after 30 minutes of inactivity */
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

/** Periodic sync interval: check every 12–18 minutes (jittered to avoid thundering herd) */
const INTERVAL_MIN_MS = 12 * 60 * 1000;
const INTERVAL_MAX_MS = 18 * 60 * 1000;

function getJitteredInterval(): number {
  return INTERVAL_MIN_MS + Math.random() * (INTERVAL_MAX_MS - INTERVAL_MIN_MS);
}

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : undefined;
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0`;
}

export function useSyncMatches(isLinked: boolean = false) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const router = useRouter();
  const toastIdRef = useRef<string | number | undefined>(undefined);
  const lastSyncAtRef = useRef<number>(0);
  const isSyncingRef = useRef(false);

  const handleSync = useCallback(
    (options?: SyncOptions) => {
      // Use ref for the guard check — state may be stale in closures
      if (isSyncingRef.current) return;

      const silent = options?.silent ?? false;

      isSyncingRef.current = true;
      setIsSyncing(true);
      setProgress(null);

      if (!silent) {
        toastIdRef.current = toast.loading("Fetching latest matches...");
      } else {
        toastIdRef.current = undefined;
      }

      // Use fetch + ReadableStream instead of EventSource to avoid
      // spurious onerror firing when the server closes the stream.
      fetch("/api/sync")
        .then(async (res) => {
          if (!res.ok || !res.body) {
            throw new Error(
              res.ok
                ? "No response body"
                : `Something went wrong while fetching matches. Please try again.`
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
                  if (!silent) {
                    toast.loading(data.message, { id: toastIdRef.current });
                  }
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
                  // For silent syncs that DO find new matches, upgrade to a visible toast
                  if (silent && data.synced > 0 && !toastIdRef.current) {
                    toastIdRef.current = toast.loading(
                      `${data.message} (${data.synced} imported, ${pct}%)`,
                    );
                  } else {
                    toast.loading(
                      `${data.message} (${data.synced} imported, ${pct}%)`,
                      { id: toastIdRef.current }
                    );
                  }
                  break;
                }

                case "done":
                  receivedFinal = true;
                  if (data.synced > 0) {
                    toast.success(data.message, {
                      id: toastIdRef.current,
                      duration: 8000,
                    });
                    router.refresh();
                  } else if (!silent) {
                    // Manual/login sync: always show the result
                    toast.info(data.message, {
                      id: toastIdRef.current,
                      duration: 8000,
                    });
                    router.refresh();
                  }
                  // Silent sync with 0 new matches: no toast, no refresh
                  break;

                case "error":
                  receivedFinal = true;
                  if (!silent || toastIdRef.current) {
                    toast.error(data.message, {
                      id: toastIdRef.current,
                      duration: 10000,
                    });
                  }
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
          if (!receivedFinal && !silent) {
            toast.warning(
              "Update ended unexpectedly. Check if your matches are up to date.",
              { id: toastIdRef.current, duration: 8000 }
            );
          }
        })
        .catch((error) => {
          // Only fires on actual network errors (fetch failure, aborted, etc.)
          // NOT on clean server-side stream close.
          if (!silent || toastIdRef.current) {
            const message =
              error instanceof Error
                ? error.message
                : "Connection lost while updating matches.";
            toast.error(message, { id: toastIdRef.current });
          }
        })
        .finally(() => {
          isSyncingRef.current = false;
          setIsSyncing(false);
          setProgress(null);
          lastSyncAtRef.current = Date.now();
        });
    },
    [router]
  );

  // --- Auto-sync trigger 1: Login cookie ---
  useEffect(() => {
    if (!isLinked) return;
    const cookie = getCookie("sync_on_login");
    if (cookie) {
      deleteCookie("sync_on_login");
      // Small delay to let the page settle after login redirect
      const timer = setTimeout(() => handleSync(), 500);
      return () => clearTimeout(timer);
    }
  }, [isLinked, handleSync]);

  // --- Auto-sync trigger 2: Tab visibility change (stale session) ---
  useEffect(() => {
    if (!isLinked) return;

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") return;
      if (isSyncingRef.current) return;

      const elapsed = Date.now() - lastSyncAtRef.current;
      if (elapsed >= STALE_THRESHOLD_MS) {
        handleSync({ silent: true });
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [isLinked, handleSync]);

  // --- Auto-sync trigger 3: Periodic interval (jittered 12–18 min) ---
  useEffect(() => {
    if (!isLinked) return;

    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const interval = getJitteredInterval();
      timer = setTimeout(() => {
        if (!isSyncingRef.current) {
          handleSync({ silent: true });
        }
        scheduleNext();
      }, interval);
    };

    scheduleNext();
    return () => clearTimeout(timer);
  }, [isLinked, handleSync]);

  return { isSyncing, progress, handleSync };
}
