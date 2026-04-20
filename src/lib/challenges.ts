// ─── Internal challenge helpers (NOT a server action) ───────────────────────
// These functions accept a userId parameter and are only called server-to-server
// (e.g., from the sync route). They must NEVER be exported from a "use server"
// file, otherwise a client could invoke them with an arbitrary userId.

import { eq, and, desc, isNull } from "drizzle-orm";

import { db } from "@/db";
import { challenges, rankSnapshots, matches } from "@/db/schema";
import { invalidateChallengesCaches } from "@/lib/cache";
import { hasReachedTarget } from "@/lib/rank";

/**
 * Check whether a user's active by-date challenges have been completed
 * based on their latest rank snapshot. Called after each rank snapshot capture.
 * Returns the number of challenges that were just completed.
 */
export async function checkByDateChallenges(
  userId: string,
  riotAccountId: string | null,
): Promise<number> {
  const accountFilter = riotAccountId
    ? eq(challenges.riotAccountId, riotAccountId)
    : isNull(challenges.riotAccountId);

  const activeChallenges = await db.query.challenges.findMany({
    where: and(
      eq(challenges.userId, userId),
      eq(challenges.status, "active"),
      eq(challenges.type, "by-date"),
      accountFilter,
    ),
  });

  if (activeChallenges.length === 0) return 0;

  const snapshotAccountFilter = riotAccountId
    ? eq(rankSnapshots.riotAccountId, riotAccountId)
    : isNull(rankSnapshots.riotAccountId);

  const latestSnapshot = await db.query.rankSnapshots.findFirst({
    where: and(eq(rankSnapshots.userId, userId), snapshotAccountFilter),
    orderBy: desc(rankSnapshots.capturedAt),
  });

  if (!latestSnapshot?.tier) return 0;

  let completedCount = 0;

  for (const challenge of activeChallenges) {
    if (!challenge.targetTier) continue;

    const reached = hasReachedTarget(
      latestSnapshot.tier,
      latestSnapshot.division,
      latestSnapshot.lp ?? 0,
      challenge.targetTier,
      challenge.targetDivision,
    );

    if (reached) {
      await db
        .update(challenges)
        .set({ status: "completed", completedAt: new Date() })
        .where(eq(challenges.id, challenge.id));
      completedCount++;
    }
  }

  if (completedCount > 0) {
    invalidateChallengesCaches(userId);
  }

  return completedCount;
}

/** Metric accessor for a match row. */
function getMatchMetric(
  match: { csPerMin: number | null; deaths: number; visionScore: number | null },
  metric: string,
): number | null {
  switch (metric) {
    case "cspm":
      return match.csPerMin;
    case "deaths":
      return match.deaths;
    case "vision_score":
      return match.visionScore;
    default:
      return null;
  }
}

/** Check if a metric value meets the condition (inclusive). */
function meetsCondition(value: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case "at_least":
      return value >= threshold;
    case "at_most":
      return value <= threshold;
    default:
      return false;
  }
}

/**
 * Evaluate a single match against active by-games challenges.
 * Called after each new match is synced.
 */
export async function evaluateByGamesChallenges(userId: string, matchId: string): Promise<void> {
  const activeChallenges = await db.query.challenges.findMany({
    where: and(
      eq(challenges.userId, userId),
      eq(challenges.status, "active"),
      eq(challenges.type, "by-games"),
    ),
  });

  if (activeChallenges.length === 0) return;

  const match = await db.query.matches.findFirst({
    where: and(eq(matches.id, matchId), eq(matches.userId, userId)),
    columns: {
      csPerMin: true,
      deaths: true,
      visionScore: true,
    },
  });

  if (!match) return;

  let invalidate = false;

  for (const challenge of activeChallenges) {
    if (
      !challenge.metric ||
      !challenge.metricCondition ||
      challenge.metricThreshold == null ||
      !challenge.targetGames
    ) {
      continue;
    }

    const value = getMatchMetric(
      match as { csPerMin: number | null; deaths: number; visionScore: number | null },
      challenge.metric,
    );
    if (value == null) continue;

    const success = meetsCondition(value, challenge.metricCondition, challenge.metricThreshold);
    const newCurrent = (challenge.currentGames ?? 0) + 1;
    const newSuccessful = (challenge.successfulGames ?? 0) + (success ? 1 : 0);

    if (newCurrent >= challenge.targetGames) {
      // Challenge complete — determine if succeeded or failed
      // Success requires ALL games to have met the condition
      const allSucceeded = newSuccessful >= challenge.targetGames;
      await db
        .update(challenges)
        .set({
          currentGames: newCurrent,
          successfulGames: newSuccessful,
          status: allSucceeded ? "completed" : "failed",
          ...(allSucceeded ? { completedAt: new Date() } : { failedAt: new Date() }),
        })
        .where(eq(challenges.id, challenge.id));
      invalidate = true;
    } else {
      // Early failure: if we've already failed more games than allowed,
      // the challenge is mathematically impossible (ALL games must pass)
      const failedGames = newCurrent - newSuccessful;
      const isImpossible = failedGames > 0;

      await db
        .update(challenges)
        .set({
          currentGames: newCurrent,
          successfulGames: newSuccessful,
          ...(isImpossible ? { status: "failed" as const, failedAt: new Date() } : {}),
        })
        .where(eq(challenges.id, challenge.id));
      invalidate = true;
    }
  }

  if (invalidate) {
    invalidateChallengesCaches(userId);
  }
}
