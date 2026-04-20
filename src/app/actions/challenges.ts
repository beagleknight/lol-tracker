"use server";

import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { challenges, challengeTopics, rankSnapshots } from "@/db/schema";
import { invalidateChallengesCaches } from "@/lib/cache";
import { blockIfImpersonating, requireUser } from "@/lib/session";

// ─── Supported metrics for by-games challenges ─────────────────────────────

export type ChallengeMetric = "cspm" | "deaths" | "vision_score";
export type MetricCondition = "above" | "below" | "at_least" | "at_most";

// ─── Create a by-date challenge (rank target) ──────────────────────────────

export async function createByDateChallenge(data: {
  targetTier: string;
  targetDivision: string | null;
  deadline: string | null;
  topicIds?: number[];
}) {
  const user = await requireUser();
  await blockIfImpersonating();

  // Get current rank from latest snapshot
  const snapshotConditions = [eq(rankSnapshots.userId, user.id)];
  if (user.activeRiotAccountId) {
    snapshotConditions.push(eq(rankSnapshots.riotAccountId, user.activeRiotAccountId));
  }
  const latestSnapshot = await db.query.rankSnapshots.findFirst({
    where: and(...snapshotConditions),
    orderBy: desc(rankSnapshots.capturedAt),
  });

  if (!latestSnapshot?.tier) {
    return { error: "No rank data found. Sync your account first to set a challenge." };
  }

  const tierName = data.targetTier.charAt(0) + data.targetTier.slice(1).toLowerCase();
  const title = data.targetDivision
    ? `Reach ${tierName} ${data.targetDivision}`
    : `Reach ${tierName}`;

  const [challenge] = await db
    .insert(challenges)
    .values({
      userId: user.id,
      riotAccountId: user.activeRiotAccountId,
      title,
      type: "by-date",
      targetTier: data.targetTier,
      targetDivision: data.targetDivision,
      startTier: latestSnapshot.tier,
      startDivision: latestSnapshot.division,
      startLp: latestSnapshot.lp ?? 0,
      deadline: data.deadline ? new Date(data.deadline) : null,
    })
    .returning({ id: challenges.id });

  if (data.topicIds?.length) {
    await db.insert(challengeTopics).values(
      data.topicIds.map((topicId) => ({
        challengeId: challenge.id,
        topicId,
      })),
    );
  }

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  invalidateChallengesCaches(user.id);

  return { success: true, challengeId: challenge.id };
}

// ─── Create a by-games challenge (metric over N games) ─────────────────────

export async function createByGamesChallenge(data: {
  title: string;
  metric: ChallengeMetric;
  metricCondition: MetricCondition;
  metricThreshold: number;
  targetGames: number;
  topicIds?: number[];
}) {
  const user = await requireUser();
  await blockIfImpersonating();

  const [challenge] = await db
    .insert(challenges)
    .values({
      userId: user.id,
      riotAccountId: user.activeRiotAccountId,
      title: data.title,
      type: "by-games",
      metric: data.metric,
      metricCondition: data.metricCondition,
      metricThreshold: data.metricThreshold,
      targetGames: data.targetGames,
      currentGames: 0,
      successfulGames: 0,
    })
    .returning({ id: challenges.id });

  if (data.topicIds?.length) {
    await db.insert(challengeTopics).values(
      data.topicIds.map((topicId) => ({
        challengeId: challenge.id,
        topicId,
      })),
    );
  }

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  invalidateChallengesCaches(user.id);

  return { success: true, challengeId: challenge.id };
}

// ─── Retire a challenge ────────────────────────────────────────────────────

export async function retireChallenge(challengeId: number) {
  const user = await requireUser();
  await blockIfImpersonating();

  const challenge = await db.query.challenges.findFirst({
    where: and(
      eq(challenges.id, challengeId),
      eq(challenges.userId, user.id),
      eq(challenges.status, "active"),
    ),
  });

  if (!challenge) {
    return { error: "Active challenge not found." };
  }

  await db
    .update(challenges)
    .set({ status: "retired", retiredAt: new Date() })
    .where(eq(challenges.id, challengeId));

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  invalidateChallengesCaches(user.id);

  return { success: true };
}

// ─── Delete a challenge ────────────────────────────────────────────────────

export async function deleteChallenge(challengeId: number) {
  const user = await requireUser();
  await blockIfImpersonating();

  await db
    .delete(challenges)
    .where(and(eq(challenges.id, challengeId), eq(challenges.userId, user.id)));

  revalidatePath("/challenges");
  revalidatePath("/dashboard");
  invalidateChallengesCaches(user.id);

  return { success: true };
}
