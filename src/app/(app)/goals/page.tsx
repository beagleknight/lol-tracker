import { and, eq, desc } from "drizzle-orm";

import { db } from "@/db";
import { goals, rankSnapshots } from "@/db/schema";
import { requireUser } from "@/lib/session";

import { GoalsClient } from "./goals-client";

export default async function GoalsPage() {
  const user = await requireUser();

  const [allGoals, latestSnapshot] = await Promise.all([
    db.query.goals.findMany({
      where: and(eq(goals.userId, user.id), eq(goals.riotAccountId, user.activeRiotAccountId!)),
      orderBy: desc(goals.createdAt),
    }),
    db.query.rankSnapshots.findFirst({
      where: and(
        eq(rankSnapshots.userId, user.id),
        eq(rankSnapshots.riotAccountId, user.activeRiotAccountId!),
      ),
      orderBy: desc(rankSnapshots.capturedAt),
    }),
  ]);

  return (
    <GoalsClient
      goals={allGoals}
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
