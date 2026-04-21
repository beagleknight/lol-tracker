// ─── Internal challenge helpers (NOT a server action) ───────────────────────
// These functions accept a userId parameter and are only called server-to-server
// (e.g., from the sync route). They must NEVER be exported from a "use server"
// file, otherwise a client could invoke them with an arbitrary userId.

import { eq, and, desc, isNull } from "drizzle-orm";

import { db } from "@/db";
import { challenges, rankSnapshots, matches } from "@/db/schema";
import { hasReachedTarget } from "@/lib/rank";

/**
 * Represents a challenge that just changed status during sync.
 * Sent to the client so we can show a celebration/failure modal.
 */
export interface ChallengeTransition {
  id: number;
  title: string;
  status: "completed" | "failed";
  type: "by-games" | "by-date";
  /** For by-games: the metric that was tracked */
  metric?: string | null;
  /** For by-games: the threshold value */
  metricThreshold?: number | null;
  /** For by-games: "at_least" or "at_most" */
  metricCondition?: string | null;
  /** For by-games: total games required */
  targetGames?: number | null;
  /** For by-games: how many games the user actually passed */
  successfulGames?: number | null;
  /** For by-date: the target rank tier */
  targetTier?: string | null;
  /** For by-date: the target rank division */
  targetDivision?: string | null;
}

/**
 * Check whether a user's active by-date challenges have been completed
 * based on their latest rank snapshot. Called after each rank snapshot capture.
 * Returns an array of challenge transitions (completed challenges).
 */
export async function checkByDateChallenges(
  userId: string,
  riotAccountId: string | null,
): Promise<ChallengeTransition[]> {
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

  if (activeChallenges.length === 0) return [];

  const snapshotAccountFilter = riotAccountId
    ? eq(rankSnapshots.riotAccountId, riotAccountId)
    : isNull(rankSnapshots.riotAccountId);

  const latestSnapshot = await db.query.rankSnapshots.findFirst({
    where: and(eq(rankSnapshots.userId, userId), snapshotAccountFilter),
    orderBy: desc(rankSnapshots.capturedAt),
  });

  if (!latestSnapshot?.tier) return [];

  const transitions: ChallengeTransition[] = [];

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
      transitions.push({
        id: challenge.id,
        title: challenge.title,
        status: "completed",
        type: "by-date",
        targetTier: challenge.targetTier,
        targetDivision: challenge.targetDivision,
      });
    }
  }

  return transitions;
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
 * Returns an array of challenge transitions (completed or failed).
 */
export async function evaluateByGamesChallenges(
  userId: string,
  matchId: string,
): Promise<ChallengeTransition[]> {
  const activeChallenges = await db.query.challenges.findMany({
    where: and(
      eq(challenges.userId, userId),
      eq(challenges.status, "active"),
      eq(challenges.type, "by-games"),
    ),
  });

  if (activeChallenges.length === 0) return [];

  const match = await db.query.matches.findFirst({
    where: and(eq(matches.id, matchId), eq(matches.userId, userId)),
    columns: {
      csPerMin: true,
      deaths: true,
      visionScore: true,
      gameDate: true,
    },
  });

  if (!match) return [];

  const transitions: ChallengeTransition[] = [];

  for (const challenge of activeChallenges) {
    // Only count matches played AFTER the challenge was created.
    // Without this check, a batch sync of older matches would count
    // pre-challenge games against the challenge counters.
    if (match.gameDate && challenge.createdAt && match.gameDate < challenge.createdAt) {
      continue;
    }

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
      const newStatus = allSucceeded ? "completed" : "failed";
      await db
        .update(challenges)
        .set({
          currentGames: newCurrent,
          successfulGames: newSuccessful,
          status: newStatus,
          ...(allSucceeded ? { completedAt: new Date() } : { failedAt: new Date() }),
        })
        .where(eq(challenges.id, challenge.id));
      transitions.push({
        id: challenge.id,
        title: challenge.title,
        status: newStatus,
        type: "by-games",
        metric: challenge.metric,
        metricThreshold: challenge.metricThreshold,
        metricCondition: challenge.metricCondition,
        targetGames: challenge.targetGames,
        successfulGames: allSucceeded ? newSuccessful : newSuccessful,
      });
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

      if (isImpossible) {
        transitions.push({
          id: challenge.id,
          title: challenge.title,
          status: "failed",
          type: "by-games",
          metric: challenge.metric,
          metricThreshold: challenge.metricThreshold,
          metricCondition: challenge.metricCondition,
          targetGames: challenge.targetGames,
          successfulGames: newSuccessful,
        });
      }
    }
  }

  return transitions;
}
