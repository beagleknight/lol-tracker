import { and, eq, desc, ne, sql } from "drizzle-orm";

import { db } from "@/db";
import { matches, rankSnapshots } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { requireUser } from "@/lib/session";
import { getTopicsForUser } from "@/lib/topics";

import { NewChallengeClient } from "./new-challenge-client";

export default async function NewChallengePage() {
  const user = await requireUser();

  const [latestSnapshot, userTopics, playerStats] = await Promise.all([
    db.query.rankSnapshots.findFirst({
      where: and(
        eq(rankSnapshots.userId, user.id),
        accountScope(rankSnapshots.riotAccountId, user.activeRiotAccountId),
      ),
      orderBy: desc(rankSnapshots.capturedAt),
    }),
    getTopicsForUser(user.id),
    // Average stats from last 20 non-remake games
    db
      .select({
        avgCsPerMin: sql<number | null>`ROUND(AVG(${matches.csPerMin}), 1)`,
        avgDeaths: sql<number | null>`ROUND(AVG(${matches.deaths}), 1)`,
        avgVisionScore: sql<number | null>`ROUND(AVG(${matches.visionScore}), 1)`,
        totalGames: sql<number>`COUNT(*)`,
      })
      .from(matches)
      .where(
        and(
          eq(matches.userId, user.id),
          accountScope(matches.riotAccountId, user.activeRiotAccountId),
          ne(matches.result, "Remake"),
        ),
      )
      .limit(20),
  ]);

  const stats = playerStats[0] ?? {
    avgCsPerMin: null,
    avgDeaths: null,
    avgVisionScore: null,
    totalGames: 0,
  };

  return (
    <NewChallengeClient
      currentRank={
        latestSnapshot?.tier
          ? {
              tier: latestSnapshot.tier,
              division: latestSnapshot.division,
              lp: latestSnapshot.lp ?? 0,
            }
          : null
      }
      availableTopics={userTopics.map((t) => ({ id: t.id, name: t.name }))}
      playerStats={{
        cspm: stats.avgCsPerMin,
        deaths: stats.avgDeaths,
        visionScore: stats.avgVisionScore,
        totalGames: stats.totalGames,
      }}
    />
  );
}
