import { db } from "@/db";
import { matches, coachingSessions, rankSnapshots, goals } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { cacheLife, cacheTag } from "next/cache";
import { analyticsTag, goalsTag } from "@/lib/cache";
import { AnalyticsClient } from "./analytics-client";

async function getCachedAnalyticsData(userId: string) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(analyticsTag(userId), goalsTag(userId));

  const [allMatches, sessions, ranks, ddragonVersion, activeGoal] = await Promise.all([
    db.query.matches.findMany({
      where: eq(matches.userId, userId),
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
      where: eq(rankSnapshots.userId, userId),
      orderBy: asc(rankSnapshots.capturedAt),
    }),
    getLatestVersion(),
    db.query.goals.findFirst({
      where: and(eq(goals.userId, userId), eq(goals.status, "active")),
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
  const { allMatches, sessions, ranks, ddragonVersion, activeGoal } =
    await getCachedAnalyticsData(user.id);

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
