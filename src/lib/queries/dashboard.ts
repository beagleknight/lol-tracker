/**
 * Shared dashboard queries.
 * Extracted from (app)/dashboard/page.tsx for reuse in (demo)/dashboard/page.tsx.
 */

import { eq, desc, and, count, sql, asc, lte, ne, gte } from "drizzle-orm";

import type { DateRange } from "@/lib/seasons";

import { db } from "@/db";
import {
  matches,
  rankSnapshots,
  coachingActionItems,
  coachingSessions,
  challenges,
} from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { toCumulativeLP } from "@/lib/rank";
import { getLatestVersion } from "@/lib/riot-api";
import { getDefaultTopics } from "@/lib/topics";

import { getHighlightsPerMatch } from "./highlights";

export async function getDashboardData(
  userId: string,
  accountId: string | null,
  dateRange?: DateRange | null,
) {
  // Build date conditions for queries that should respect the season filter
  const dateConditions = dateRange
    ? [
        gte(matches.gameDate, dateRange.start),
        ...(dateRange.end ? [lte(matches.gameDate, dateRange.end)] : []),
      ]
    : [];
  const [
    ddragonVersion,
    recentMatches,
    latestRank,
    activeActionItems,
    matchStats,
    upcomingSession,
    activeChallenges,
    lastCompletedSession,
    topicNames,
  ] = await Promise.all([
    getLatestVersion(),
    db.query.matches.findMany({
      where: and(
        eq(matches.userId, userId),
        accountScope(matches.riotAccountId, accountId),
        ne(matches.result, "Remake"),
        ...dateConditions,
      ),
      orderBy: desc(matches.gameDate),
      limit: 10,
      columns: {
        id: true,
        gameDate: true,
        result: true,
        championId: true,
        championName: true,
        runeKeystoneId: true,
        runeKeystoneName: true,
        matchupChampionId: true,
        matchupChampionName: true,
        kills: true,
        deaths: true,
        assists: true,
        cs: true,
        csPerMin: true,
        gameDurationSeconds: true,
        goldEarned: true,
        visionScore: true,
        reviewed: true,
        comment: true,
        duoPartnerPuuid: true,
        queueId: true,
        position: true,
      },
    }),
    db.query.rankSnapshots.findFirst({
      where: and(
        eq(rankSnapshots.userId, userId),
        accountScope(rankSnapshots.riotAccountId, accountId),
      ),
      orderBy: desc(rankSnapshots.capturedAt),
    }),
    db.query.coachingActionItems.findMany({
      where: and(eq(coachingActionItems.userId, userId), eq(coachingActionItems.status, "active")),
      limit: 10,
    }),
    db
      .select({
        total: count(sql`CASE WHEN ${matches.result} != 'Remake' THEN 1 END`),
        wins: count(sql`CASE WHEN ${matches.result} = 'Victory' THEN 1 END`),
        remakes: count(sql`CASE WHEN ${matches.result} = 'Remake' THEN 1 END`),
        unreviewed: count(
          sql`CASE WHEN ${matches.reviewed} = 0 AND ${matches.result} != 'Remake' THEN 1 END`,
        ),
      })
      .from(matches)
      .where(
        and(
          eq(matches.userId, userId),
          accountScope(matches.riotAccountId, accountId),
          ...dateConditions,
        ),
      ),
    db.query.coachingSessions.findFirst({
      where: and(eq(coachingSessions.userId, userId), eq(coachingSessions.status, "scheduled")),
      orderBy: asc(coachingSessions.date),
      columns: { id: true, coachName: true, date: true, vodMatchId: true },
    }),
    db.query.challenges.findMany({
      where: and(
        eq(challenges.userId, userId),
        accountScope(challenges.riotAccountId, accountId),
        eq(challenges.status, "active"),
      ),
      orderBy: desc(challenges.createdAt),
      limit: 3,
    }),
    db.query.coachingSessions.findFirst({
      where: and(eq(coachingSessions.userId, userId), eq(coachingSessions.status, "completed")),
      orderBy: desc(coachingSessions.date),
      columns: { id: true, coachName: true, date: true },
    }),
    getDefaultTopics().then((t) => t.map((topic) => ({ id: topic.id, name: topic.name }))),
  ]);

  const latestRankOrUndef = latestRank ?? null;
  const {
    total,
    wins,
    remakes: _remakes,
    unreviewed,
  } = matchStats[0] ?? { total: 0, wins: 0, remakes: 0, unreviewed: 0 };

  // Fetch highlights for recent matches
  const highlightsPerMatch = await getHighlightsPerMatch(
    userId,
    accountId,
    recentMatches.map((m) => m.id),
  );

  // LP trend calculation
  let lpTrend: number | null = null;
  let lpTrendDays: number | null = null;
  if (latestRankOrUndef?.tier && recentMatches.length >= 2) {
    const oldestGameDate = recentMatches[recentMatches.length - 1].gameDate;
    const newestGameDate = recentMatches[0].gameDate;
    lpTrendDays = Math.max(
      1,
      Math.ceil((newestGameDate.getTime() - oldestGameDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const baseline =
      (await db.query.rankSnapshots.findFirst({
        where: and(
          eq(rankSnapshots.userId, userId),
          accountScope(rankSnapshots.riotAccountId, accountId),
          lte(rankSnapshots.capturedAt, oldestGameDate),
        ),
        orderBy: desc(rankSnapshots.capturedAt),
      })) ??
      (await db.query.rankSnapshots.findFirst({
        where: and(
          eq(rankSnapshots.userId, userId),
          accountScope(rankSnapshots.riotAccountId, accountId),
        ),
        orderBy: asc(rankSnapshots.capturedAt),
      }));

    if (baseline?.tier && baseline.id !== latestRankOrUndef.id) {
      const newLP = toCumulativeLP(
        latestRankOrUndef.tier,
        latestRankOrUndef.division,
        latestRankOrUndef.lp || 0,
      );
      const oldLP = toCumulativeLP(baseline.tier, baseline.division, baseline.lp || 0);
      lpTrend = (newLP ?? 0) - (oldLP ?? 0);
    }
  }

  return {
    ddragonVersion,
    recentMatches,
    highlightsPerMatch,
    matchStats: { total, wins, losses: total - wins, unreviewed },
    latestRank: latestRankOrUndef,
    lpTrend,
    lpTrendDays,
    actionItems: activeActionItems,
    upcomingSession: upcomingSession ?? null,
    activeChallenges,
    lastCompletedSession: lastCompletedSession ?? null,
    daysSinceLastCoaching: lastCompletedSession
      ? Math.floor((Date.now() - lastCompletedSession.date.getTime()) / (1000 * 60 * 60 * 24))
      : null,
    currentRank: latestRankOrUndef?.tier
      ? {
          tier: latestRankOrUndef.tier,
          division: latestRankOrUndef.division,
          lp: latestRankOrUndef.lp ?? 0,
        }
      : null,
    topicNames,
  };
}
