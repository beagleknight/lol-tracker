/**
 * Shared analytics queries.
 * Extracted from (app)/analytics/page.tsx for reuse in (demo)/analytics/page.tsx.
 */

import { eq, asc, and, gte, lte } from "drizzle-orm";

import type { DateRange } from "@/lib/seasons";

import { db } from "@/db";
import { matches, coachingSessions, rankSnapshots, challenges } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";

export async function getAnalyticsData(
  userId: string,
  riotAccountId: string | null,
  dateRange?: DateRange | null,
) {
  const dateConditions = dateRange
    ? [
        gte(matches.gameDate, dateRange.start),
        ...(dateRange.end ? [lte(matches.gameDate, dateRange.end)] : []),
      ]
    : [];

  const [allMatches, sessions, ranks, ddragonVersion, activeGoal] = await Promise.all([
    db.query.matches.findMany({
      where: and(
        eq(matches.userId, userId),
        accountScope(matches.riotAccountId, riotAccountId),
        ...dateConditions,
      ),
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
      columns: { id: true, coachName: true, date: true, status: true },
    }),
    db.query.rankSnapshots.findMany({
      where: and(
        eq(rankSnapshots.userId, userId),
        accountScope(rankSnapshots.riotAccountId, riotAccountId),
      ),
      orderBy: asc(rankSnapshots.capturedAt),
    }),
    getLatestVersion(),
    db.query.challenges.findFirst({
      where: and(
        eq(challenges.userId, userId),
        accountScope(challenges.riotAccountId, riotAccountId),
        eq(challenges.status, "active"),
        eq(challenges.type, "by-date"),
      ),
      columns: { targetTier: true, targetDivision: true },
    }),
  ]);

  return {
    allMatches,
    sessions,
    ranks,
    ddragonVersion,
    activeGoal: activeGoal
      ? { targetTier: activeGoal.targetTier!, targetDivision: activeGoal.targetDivision }
      : null,
  };
}
