import { db } from "@/db";
import { goals, rankSnapshots } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { NewGoalClient } from "./new-goal-client";

export default async function NewGoalPage() {
  const user = await requireUser();

  // Check for existing active goal — redirect if one exists
  const activeGoal = await db.query.goals.findFirst({
    where: and(eq(goals.userId, user.id), eq(goals.status, "active")),
  });

  if (activeGoal) {
    redirect("/goals");
  }

  // Get current rank
  const latestSnapshot = await db.query.rankSnapshots.findFirst({
    where: eq(rankSnapshots.userId, user.id),
    orderBy: desc(rankSnapshots.capturedAt),
  });

  return (
    <NewGoalClient
      currentRank={
        latestSnapshot?.tier
          ? {
              tier: latestSnapshot.tier,
              division: latestSnapshot.division,
              lp: latestSnapshot.lp ?? 0,
            }
          : null
      }
    />
  );
}
