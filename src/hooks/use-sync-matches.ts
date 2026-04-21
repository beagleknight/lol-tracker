"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useRef, useEffect } from "react";
import { toast } from "sonner";

import type { ChallengeTransition } from "@/lib/challenges";

import { invalidateSyncCaches } from "@/app/actions/sync";

export interface SyncProgress {
  current: number;
  total: number;
  synced: number;
  failed: number;
  remaining: number;
  message: string;
}

interface SyncOptions {
  /** When true, skip the loading toast. Only show a toast if new matches are found. */
  silent?: boolean;
  /** Max matches to sync in this request. Omit for unlimited (batched continuation). */
  limit?: number;
}

/** Batch size for automatic continuation when syncing all remaining matches */
const CONTINUATION_BATCH_SIZE = 20;

/** Delay between continuation batches (ms) */
const CONTINUATION_DELAY_MS = 1500;

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
  const [challengeTransitions, setChallengeTransitions] = useState<ChallengeTransition[]>([]);
  const router = useRouter();
  const toastIdRef = useRef<string | number | undefined>(undefined);
  const lastSyncAtRef = useRef<number>(0);
  const isSyncingRef = useRef(false);

  const handleSync = useCallback(
    (options?: SyncOptions) => {
      // Use ref for the guard check — state may be stale in closures
      if (isSyncingRef.current) return;

      const silent = options?.silent ?? false;
      const callerLimit = options?.limit;

      isSyncingRef.current = true;
      setIsSyncing(true);
      setProgress(null);

      if (!silent) {
        toastIdRef.current = toast.loading("Fetching latest matches...");
      } else {
        toastIdRef.current = undefined;
      }

      // Tracks cumulative synced/failed across continuation batches
      let cumulativeSynced = 0;
      let cumulativeFailed = 0;
      let cumulativeTransitions: ChallengeTransition[] = [];

      const runBatch = async (limit?: number, continuation = false): Promise<void> => {
        const params = new URLSearchParams();
        if (limit) params.set("limit", String(limit));
        if (continuation) params.set("continuation", "true");
        const qs = params.toString();
        const url = qs ? `/api/sync?${qs}` : "/api/sync";
        const res = await fetch(url);

        if (!res.ok || !res.body) {
          throw new Error(
            res.ok
              ? "No response body"
              : `Something went wrong while fetching matches. Please try again.`,
          );
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let receivedFinal = false;
        let batchRemaining = 0;

        const processMessage = async (msg: string) => {
          const dataLine = msg.split("\n").find((line) => line.startsWith("data: "));
          if (!dataLine) return;

          try {
            const data = JSON.parse(dataLine.slice(6));

            switch (data.type) {
              case "status":
                if (!silent) {
                  toast.loading(data.message, { id: toastIdRef.current });
                }
                break;

              case "waiting":
                // Queued behind other syncs — always show this even in silent mode
                if (!toastIdRef.current) {
                  toastIdRef.current = toast.loading(data.message);
                } else {
                  toast.loading(data.message, { id: toastIdRef.current });
                }
                break;

              case "locked":
                // User already has a sync in progress (e.g., from another tab)
                if (!silent || toastIdRef.current) {
                  toast.info(data.message, {
                    id: toastIdRef.current,
                    duration: 6000,
                  });
                }
                break;

              case "progress": {
                const batchSynced = cumulativeSynced + data.synced;
                const batchFailed = cumulativeFailed + data.failed;
                const pct = data.total > 0 ? Math.round((data.current / data.total) * 100) : 0;
                setProgress({
                  current: data.current,
                  total: data.total,
                  synced: batchSynced,
                  failed: batchFailed,
                  remaining: data.remaining ?? 0,
                  message: data.message,
                });
                // For silent syncs that DO find new matches, upgrade to a visible toast
                if (silent && batchSynced > 0 && !toastIdRef.current) {
                  toastIdRef.current = toast.loading(
                    `${data.message} (${batchSynced} imported, ${pct}%)`,
                  );
                } else {
                  toast.loading(`${data.message} (${batchSynced} imported, ${pct}%)`, {
                    id: toastIdRef.current,
                  });
                }
                break;
              }

              case "done":
                receivedFinal = true;
                cumulativeSynced += data.synced ?? 0;
                cumulativeFailed += data.failed ?? 0;
                batchRemaining = data.remaining ?? 0;
                if (Array.isArray(data.challengeTransitions)) {
                  cumulativeTransitions = [...cumulativeTransitions, ...data.challengeTransitions];
                }
                setProgress((prev) =>
                  prev
                    ? {
                        ...prev,
                        remaining: batchRemaining,
                        synced: cumulativeSynced,
                        failed: cumulativeFailed,
                      }
                    : null,
                );
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
            await processMessage(msg);
          }
        }

        // Process any remaining data in the buffer after stream ends.
        if (buffer.trim()) {
          await processMessage(buffer);
        }

        // If the stream ended without a done/error event, show a warning
        if (!receivedFinal && !silent) {
          toast.warning("Update ended unexpectedly. Check if your matches are up to date.", {
            id: toastIdRef.current,
            duration: 8000,
          });
          return;
        }

        // Batched continuation: when there are remaining matches and the caller
        // didn't set a specific limit (i.e., this is a full sync), keep going
        // in batches until all matches are synced.
        if (batchRemaining > 0 && callerLimit == null) {
          toast.loading(`Syncing remaining matches (${batchRemaining} left)...`, {
            id: toastIdRef.current,
          });
          await new Promise((resolve) => setTimeout(resolve, CONTINUATION_DELAY_MS));
          await runBatch(CONTINUATION_BATCH_SIZE, true);
          return;
        }

        // All batches complete — show final result
        if (cumulativeSynced > 0) {
          const parts = [`Synced ${cumulativeSynced} match${cumulativeSynced !== 1 ? "es" : ""}`];
          if (cumulativeFailed > 0) parts.push(`(${cumulativeFailed} failed)`);
          toast.success(parts.join(" ") + ".", {
            id: toastIdRef.current,
            duration: 8000,
          });
          await invalidateSyncCaches();
          router.refresh();
        } else if (!silent) {
          toast.info("No new matches found.", {
            id: toastIdRef.current,
            duration: 8000,
          });
          router.refresh();
        }

        // Trigger challenge result modal if any transitions occurred
        if (cumulativeTransitions.length > 0) {
          setChallengeTransitions(cumulativeTransitions);
        }
      };

      // Start the first batch. If caller set a limit, use it.
      // If no limit, use CONTINUATION_BATCH_SIZE for the first batch too
      // so each individual request stays within Vercel function timeout.
      const firstBatchLimit = callerLimit ?? CONTINUATION_BATCH_SIZE;
      runBatch(firstBatchLimit)
        .catch((error) => {
          if (!silent || toastIdRef.current) {
            const message =
              error instanceof Error ? error.message : "Connection lost while updating matches.";
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
    [router],
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
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
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

  const dismissChallengeTransitions = useCallback(() => {
    setChallengeTransitions([]);
  }, []);

  return { isSyncing, progress, handleSync, challengeTransitions, dismissChallengeTransitions };
}
