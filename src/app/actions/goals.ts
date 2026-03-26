"use server";

import { db } from "@/db";
import { goals, rankSnapshots } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { invalidateGoalsCaches } from "@/lib/cache";
import { hasReachedTarget } from "@/lib/rank";

// ─── Create a new goal ──────────────────────────────────────────────────────

export async function createGoal(data: {
  targetTier: string;
  targetDivision: string | null;
  deadline: string | null; // ISO string or null
}) {
  const user = await requireUser();

  // Check for existing active goal
  const activeGoal = await db.query.goals.findFirst({
    where: and(eq(goals.userId, user.id), eq(goals.status, "active")),
  });

  if (activeGoal) {
    return { error: "You already have an active goal. Retire it before creating a new one." };
  }

  // Get current rank from latest snapshot
  const latestSnapshot = await db.query.rankSnapshots.findFirst({
    where: eq(rankSnapshots.userId, user.id),
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

  const goal = await db.query.goals.findFirst({
    where: and(
      eq(goals.id, goalId),
      eq(goals.userId, user.id),
      eq(goals.status, "active")
    ),
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

  await db
    .delete(goals)
    .where(
      and(eq(goals.id, goalId), eq(goals.userId, user.id))
    );

  revalidatePath("/goals");
  revalidatePath("/dashboard");
  invalidateGoalsCaches(user.id);

  return { success: true };
}

// ─── Check goal achievement ─────────────────────────────────────────────────
// Called after each rank snapshot capture (from sync route).
// Returns true if the goal was just achieved.

export async function checkGoalAchievement(userId: string): Promise<boolean> {
  const activeGoal = await db.query.goals.findFirst({
    where: and(eq(goals.userId, userId), eq(goals.status, "active")),
  });

  if (!activeGoal) return false;

  const latestSnapshot = await db.query.rankSnapshots.findFirst({
    where: eq(rankSnapshots.userId, userId),
    orderBy: desc(rankSnapshots.capturedAt),
  });

  if (!latestSnapshot?.tier) return false;

  const reached = hasReachedTarget(
    latestSnapshot.tier,
    latestSnapshot.division,
    latestSnapshot.lp ?? 0,
    activeGoal.targetTier,
    activeGoal.targetDivision
  );

  if (reached) {
    await db
      .update(goals)
      .set({
        status: "achieved",
        achievedAt: new Date(),
      })
      .where(eq(goals.id, activeGoal.id));

    invalidateGoalsCaches(userId);
    return true;
  }

  return false;
}
