"use server";

import { eq, and, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { goals, rankSnapshots } from "@/db/schema";
import { invalidateGoalsCaches } from "@/lib/cache";
import { blockIfImpersonating, requireUser } from "@/lib/session";

// ─── Create a new goal ──────────────────────────────────────────────────────

export async function createGoal(data: {
  targetTier: string;
  targetDivision: string | null;
  deadline: string | null; // ISO string or null
}) {
  const user = await requireUser();
  await blockIfImpersonating();

  // Check for existing active goal
  const activeGoalConditions = [eq(goals.userId, user.id), eq(goals.status, "active")];
  if (user.activeRiotAccountId) {
    activeGoalConditions.push(eq(goals.riotAccountId, user.activeRiotAccountId));
  }
  const activeGoal = await db.query.goals.findFirst({
    where: and(...activeGoalConditions),
  });

  if (activeGoal) {
    return { error: "You already have an active goal. Retire it before creating a new one." };
  }

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
    return { error: "No rank data found. Sync your account first to set a goal." };
  }

  // Build title like "Reach Platinum IV" or "Reach Master"
  const tierName = data.targetTier.charAt(0) + data.targetTier.slice(1).toLowerCase();
  const title = data.targetDivision
    ? `Reach ${tierName} ${data.targetDivision}`
    : `Reach ${tierName}`;

  const goal = await db
    .insert(goals)
    .values({
      userId: user.id,
      riotAccountId: user.activeRiotAccountId,
      title,
      targetTier: data.targetTier,
      targetDivision: data.targetDivision,
      startTier: latestSnapshot.tier,
      startDivision: latestSnapshot.division,
      startLp: latestSnapshot.lp ?? 0,
      deadline: data.deadline ? new Date(data.deadline) : null,
    })
    .returning({ id: goals.id });

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  invalidateGoalsCaches(user.id);

  return { success: true, goalId: goal[0].id };
}

// ─── Retire a goal ──────────────────────────────────────────────────────────

export async function retireGoal(goalId: number) {
  const user = await requireUser();
  await blockIfImpersonating();

  const goal = await db.query.goals.findFirst({
    where: and(eq(goals.id, goalId), eq(goals.userId, user.id), eq(goals.status, "active")),
  });

  if (!goal) {
    return { error: "Active goal not found." };
  }

  await db
    .update(goals)
    .set({
      status: "retired",
      retiredAt: new Date(),
    })
    .where(eq(goals.id, goalId));

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  invalidateGoalsCaches(user.id);

  return { success: true };
}

// ─── Delete a goal ──────────────────────────────────────────────────────────

export async function deleteGoal(goalId: number) {
  const user = await requireUser();
  await blockIfImpersonating();

  await db.delete(goals).where(and(eq(goals.id, goalId), eq(goals.userId, user.id)));

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  invalidateGoalsCaches(user.id);

  return { success: true };
}
