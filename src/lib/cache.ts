import { updateTag } from "next/cache";

// ─── Cache Tag Helpers ──────────────────────────────────────────────────────
// Centralized tag naming so mutations and cached functions stay in sync.
// Every cached function uses one of these tags; every mutation invalidates
// the relevant tags via the helpers below.

export const duoTag = (userId: string) => `duo-${userId}`;
export const analyticsTag = (userId: string) => `analytics-${userId}`;
export const coachingTag = (userId: string) => `coaching-${userId}`;
export const scoutTag = (userId: string) => `scout-${userId}`;
export const goalsTag = (userId: string) => `goals-${userId}`;

// ─── Invalidation Helpers ───────────────────────────────────────────────────
// Call these from Server Actions after writing to the DB.
// All use updateTag() for immediate expiration (read-your-own-writes).

/** Invalidate all Tier 1 caches for a user (sync, account link/unlink). */
export function invalidateAllCaches(userId: string) {
  updateTag(duoTag(userId));
  updateTag(analyticsTag(userId));
  updateTag(coachingTag(userId));
  updateTag(scoutTag(userId));
  updateTag(goalsTag(userId));
}

/** Invalidate caches affected by match review changes. */
export function invalidateReviewCaches(userId: string) {
  updateTag(analyticsTag(userId));
  updateTag(coachingTag(userId));
  updateTag(scoutTag(userId));
}

/** Invalidate caches affected by coaching mutations. */
export function invalidateCoachingCaches(userId: string) {
  updateTag(coachingTag(userId));
}

/** Invalidate caches affected by duo partner data changes. */
export function invalidateDuoCaches(userId: string) {
  updateTag(duoTag(userId));
}

/** Invalidate caches affected by duo backfill (touches matches table). */
export function invalidateDuoBackfillCaches(userId: string) {
  updateTag(duoTag(userId));
  updateTag(analyticsTag(userId));
  updateTag(scoutTag(userId));
}

/** Invalidate caches affected by goal mutations. */
export function invalidateGoalsCaches(userId: string) {
  updateTag(goalsTag(userId));
}
