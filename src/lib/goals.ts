// ─── Internal goal helpers (NOT a server action) ────────────────────────────
// These functions accept a userId parameter and are only called server-to-server
// (e.g., from the sync route). They must NEVER be exported from a "use server"
// file, otherwise a client could invoke them with an arbitrary userId.

import { eq, and, desc, isNull } from "drizzle-orm";

import { db } from "@/db";
import { goals, rankSnapshots } from "@/db/schema";
import { hasReachedTarget } from "@/lib/rank";

/**
 * Check whether a user's active goal has been achieved based on their latest
 * rank snapshot. Called after each rank snapshot capture (from sync route).
 * Returns true if the goal was just achieved.
 */
export async function checkGoalAchievement(
  userId: string,
  riotAccountId: string | null,
): Promise<boolean> {
  const accountFilter = riotAccountId
    ? eq(goals.riotAccountId, riotAccountId)
    : isNull(goals.riotAccountId);

  const activeGoal = await db.query.goals.findFirst({
    where: and(eq(goals.userId, userId), eq(goals.status, "active"), accountFilter),
  });

  if (!activeGoal) return false;

  const snapshotAccountFilter = riotAccountId
    ? eq(rankSnapshots.riotAccountId, riotAccountId)
    : isNull(rankSnapshots.riotAccountId);

  const latestSnapshot = await db.query.rankSnapshots.findFirst({
    where: and(eq(rankSnapshots.userId, userId), snapshotAccountFilter),
    orderBy: desc(rankSnapshots.capturedAt),
  });

  if (!latestSnapshot?.tier) return false;

  const reached = hasReachedTarget(
    latestSnapshot.tier,
    latestSnapshot.division,
    latestSnapshot.lp ?? 0,
    activeGoal.targetTier,
    activeGoal.targetDivision,
  );

  if (reached) {
    await db
      .update(goals)
      .set({
        status: "achieved",
        achievedAt: new Date(),
      })
      .where(eq(goals.id, activeGoal.id));

    return true;
  }

  return false;
}
