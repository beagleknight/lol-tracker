import { revalidateTag } from "next/cache";

// ─── Cache Tag Helpers ──────────────────────────────────────────────────────
// Centralized tag naming so mutations and cached functions stay in sync.
// Every cached function uses one of these tags; every mutation invalidates
// the relevant tags via the helpers below.

export const duoTag = (userId: string) => `duo-${userId}`;
export const analyticsTag = (userId: string) => `analytics-${userId}`;
export const coachingTag = (userId: string) => `coaching-${userId}`;
export const scoutTag = (userId: string) => `scout-${userId}`;

// ─── Invalidation Helpers ───────────────────────────────────────────────────
// Call these from mutation actions / API routes after writing to the DB.
// All use profile="max" for stale-while-revalidate semantics.

/** Invalidate all Tier 1 caches for a user (sync, account link/unlink, CSV import). */
export function invalidateAllCaches(userId: string) {
  revalidateTag(duoTag(userId), "max");
  revalidateTag(analyticsTag(userId), "max");
  revalidateTag(coachingTag(userId), "max");
  revalidateTag(scoutTag(userId), "max");
}

/** Invalidate caches affected by match review changes. */
export function invalidateReviewCaches(userId: string) {
  revalidateTag(analyticsTag(userId), "max");
  revalidateTag(coachingTag(userId), "max");
  revalidateTag(scoutTag(userId), "max");
}

/** Invalidate caches affected by coaching mutations. */
export function invalidateCoachingCaches(userId: string) {
  revalidateTag(coachingTag(userId), "max");
}

/** Invalidate caches affected by duo partner data changes. */
export function invalidateDuoCaches(userId: string) {
  revalidateTag(duoTag(userId), "max");
}

/** Invalidate caches affected by duo backfill (touches matches table). */
export function invalidateDuoBackfillCaches(userId: string) {
  revalidateTag(duoTag(userId), "max");
  revalidateTag(analyticsTag(userId), "max");
  revalidateTag(scoutTag(userId), "max");
}
