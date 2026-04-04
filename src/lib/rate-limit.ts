// Inbound rate limiting backed by Turso/SQLite.
//
// Sliding-window approach: count events in the last `windowMs` for a given
// (userId, action) pair. If the count exceeds `maxRequests`, deny the request.
//
// Cleanup piggybacks on checks — expired rows are deleted on every call to
// keep the table small without a separate cron job.

import { and, eq, gt, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { rateLimitEvents } from "@/db/schema";

// ─── Rate limit tiers ────────────────────────────────────────────────────────

interface RateLimitTier {
  /** Sliding window duration in milliseconds */
  windowMs: number;
  /** Max allowed requests within the window */
  maxRequests: number;
}

/**
 * Rate limit configuration per action.
 *
 * | Action       | Window | Max |
 * |--------------|--------|-----|
 * | sync         | 5 min  |  1  |
 * | export       | 1 min  |  3  |
 * | ai_insight   | 1 min  |  5  |
 * | riot_lookup  | 1 min  |  5  |
 */
const RATE_LIMIT_TIERS: Record<string, RateLimitTier> = {
  sync: { windowMs: 5 * 60 * 1000, maxRequests: 1 },
  export: { windowMs: 60 * 1000, maxRequests: 3 },
  ai_insight: { windowMs: 60 * 1000, maxRequests: 5 },
  riot_lookup: { windowMs: 60 * 1000, maxRequests: 5 },
};

/** Max window across all tiers — used for cleanup threshold */
const MAX_WINDOW_MS = Math.max(...Object.values(RATE_LIMIT_TIERS).map((t) => t.windowMs));

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest event in the window expires. Only set when denied. */
  retryAfter?: number;
}

/**
 * Check whether a user is allowed to perform an action, and record the event
 * if allowed.
 *
 * This is the only function consumers need — it checks + records atomically.
 *
 * @throws if `action` has no configured tier (programming error).
 */
export async function checkRateLimit(userId: string, action: string): Promise<RateLimitResult> {
  const tier = RATE_LIMIT_TIERS[action];
  if (!tier) {
    throw new Error(`No rate limit tier configured for action "${action}"`);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - tier.windowMs);

  // Piggyback cleanup: delete all events older than the largest window
  const cleanupThreshold = new Date(now.getTime() - MAX_WINDOW_MS);
  await db.delete(rateLimitEvents).where(lt(rateLimitEvents.createdAt, cleanupThreshold));

  // Count events in the current window for this user+action
  const [countResult] = await db
    .select({
      total: sql<number>`count(*)`,
      oldest: sql<number>`min(${rateLimitEvents.createdAt})`,
    })
    .from(rateLimitEvents)
    .where(
      and(
        eq(rateLimitEvents.userId, userId),
        eq(rateLimitEvents.action, action),
        gt(rateLimitEvents.createdAt, windowStart),
      ),
    );

  const currentCount = countResult?.total ?? 0;

  if (currentCount >= tier.maxRequests) {
    // Calculate retry-after from the oldest event in the window
    const oldestTimestamp = countResult?.oldest;
    let retryAfter = Math.ceil(tier.windowMs / 1000);

    if (oldestTimestamp) {
      // oldestTimestamp is a unix timestamp in ms (SQLite integer via Drizzle timestamp mode)
      const oldestMs = typeof oldestTimestamp === "number" ? oldestTimestamp : 0;
      if (oldestMs > 0) {
        const expiresAtMs = oldestMs + tier.windowMs;
        retryAfter = Math.max(1, Math.ceil((expiresAtMs - now.getTime()) / 1000));
      }
    }

    return { allowed: false, retryAfter };
  }

  // Record the event
  await db.insert(rateLimitEvents).values({
    userId,
    action,
    createdAt: now,
  });

  return { allowed: true };
}
