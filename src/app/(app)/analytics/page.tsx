import { eq, asc, and, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";

import { db } from "@/db";
import { matches, coachingSessions, rankSnapshots, goals } from "@/db/schema";
import { analyticsTag, goalsTag } from "@/lib/cache";
import { accountScope } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

import { AnalyticsClient } from "./analytics-client";

async function getCachedAnalyticsData(userId: string, riotAccountId: string | null) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(analyticsTag(userId), goalsTag(userId));

  const [allMatches, sessions, ranks, ddragonVersion, activeGoal] = await Promise.all([
    db.query.matches.findMany({
      where: and(eq(matches.userId, userId), accountScope(matches.riotAccountId, riotAccountId)),
      orderBy: asc(matches.gameDate),
      columns: {
        gameDate: true,
        result: true,
        championName: true,
        matchupChampionName: true,
        runeKeystoneName: true,
        kills: true,
        deaths: true,
        assists: true,
      },
    }),
    db.query.coachingSessions.findMany({
      where: eq(coachingSessions.userId, userId),
      orderBy: asc(coachingSessions.date),
      columns: {
        id: true,
        coachName: true,
        date: true,
        status: true,
      },
    }),
    db.query.rankSnapshots.findMany({
      where: and(
        eq(rankSnapshots.userId, userId),
        accountScope(rankSnapshots.riotAccountId, riotAccountId),
      ),
      orderBy: asc(rankSnapshots.capturedAt),
    }),
    getLatestVersion(),
    db.query.goals.findFirst({
      where: and(
        eq(goals.userId, userId),
        accountScope(goals.riotAccountId, riotAccountId),
        eq(goals.status, "active"),
      ),
      columns: {
        targetTier: true,
        targetDivision: true,
      },
    }),
  ]);

  return { allMatches, sessions, ranks, ddragonVersion, activeGoal: activeGoal ?? null };
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const { allMatches, sessions, ranks, ddragonVersion, activeGoal } = await getCachedAnalyticsData(
    user.id,
    user.activeRiotAccountId,
  );

  return (
    <AnalyticsClient
      matches={allMatches}
      coachingSessions={sessions}
      rankSnapshots={ranks}
      ddragonVersion={ddragonVersion}
      activeGoal={activeGoal}
    />
  );
}
