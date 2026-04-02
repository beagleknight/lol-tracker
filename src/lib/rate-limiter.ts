// Riot API rate limiter — adaptive delay based on response headers
//
// Development key limits:
//   - 20 requests per 1 second
//   - 100 requests per 2 minutes (120 seconds)
//
// Instead of a DB-based token bucket (which adds 2 DB round-trips per API call),
// we read the `X-App-Rate-Limit-Count` header from every Riot response to know
// exactly how much budget we've consumed, and adaptively slow down.

/** Parsed rate limit state from Riot response headers. */
export interface RateLimitInfo {
  /** Requests used in the 1-second window. */
  shortCount: number;
  /** Max requests in the 1-second window. */
  shortLimit: number;
  /** Requests used in the 2-minute window. */
  longCount: number;
  /** Max requests in the 2-minute window. */
  longLimit: number;
}

/**
 * Parse `X-App-Rate-Limit` and `X-App-Rate-Limit-Count` headers.
 *
 * Format: "20:1,100:120" (limit:window pairs)
 * Count:  "5:1,42:120"   (used:window pairs)
 *
 * Returns null if headers are missing (e.g., on error responses or demo mode).
 */
export function parseRateLimitHeaders(headers: Headers): RateLimitInfo | null {
  const limitHeader = headers.get("X-App-Rate-Limit");
  const countHeader = headers.get("X-App-Rate-Limit-Count");

  if (!limitHeader || !countHeader) return null;

  const limits = parsePairs(limitHeader);
  const counts = parsePairs(countHeader);

  // Find the short window (1s) and long window (120s)
  // The short window has interval <= 1, long window is everything else
  const shortLimit = limits.find((p) => p.window <= 1);
  const longLimit = limits.find((p) => p.window > 1);
  const shortCount = counts.find((p) => p.window <= 1);
  const longCount = counts.find((p) => p.window > 1);

  if (!shortLimit || !longLimit || !shortCount || !longCount) return null;

  return {
    shortCount: shortCount.value,
    shortLimit: shortLimit.value,
    longCount: longCount.value,
    longLimit: longLimit.value,
  };
}

function parsePairs(header: string): Array<{ value: number; window: number }> {
  return header.split(",").map((pair) => {
    const [value, window] = pair.split(":").map(Number);
    return { value, window };
  });
}

/**
 * Calculate how long to wait before the next API call, based on current
 * rate limit consumption.
 *
 * Strategy:
 * - If >80% of the 2-minute budget is used, slow down significantly (2s delay)
 * - If >60% of the 2-minute budget is used, moderate delay (500ms)
 * - If >50% of the 1-second budget is used, small delay (200ms)
 * - Otherwise, use the minimum delay (100ms)
 *
 * The `activeSyncs` parameter further multiplies delay when multiple users
 * are syncing simultaneously, giving each sync a fair share of the budget.
 */
export function calculateAdaptiveDelay(
  info: RateLimitInfo | null,
  activeSyncs: number = 1,
): number {
  const BASE_DELAY_MS = 100;

  if (!info) {
    // No rate limit info available — use conservative default
    // Scale with concurrent syncs to avoid blindly hammering the API
    return BASE_DELAY_MS * Math.max(1, activeSyncs);
  }

  const longUsageRatio = info.longCount / info.longLimit;
  const shortUsageRatio = info.shortCount / info.shortLimit;

  let delay: number;

  if (longUsageRatio > 0.9) {
    // Critical: nearly exhausted 2-minute budget. Wait 5 seconds.
    delay = 5000;
  } else if (longUsageRatio > 0.8) {
    // High usage: slow down significantly
    delay = 2000;
  } else if (longUsageRatio > 0.6) {
    // Moderate usage: add some breathing room
    delay = 500;
  } else if (shortUsageRatio > 0.5) {
    // Per-second budget is getting tight
    delay = 200;
  } else {
    delay = BASE_DELAY_MS;
  }

  // When multiple syncs are active, each sync gets a proportional share
  // of the budget. Multiply delay by active sync count so the aggregate
  // request rate stays within limits.
  return delay * Math.max(1, activeSyncs);
}

/** Maximum concurrent syncs allowed globally. */
export const MAX_CONCURRENT_SYNCS = 2;
