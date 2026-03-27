import { db } from "@/db";
import {
  matches,
  matchHighlights,
  rankSnapshots,
  coachingActionItems,
  coachingSessions,
  goals,
} from "@/db/schema";
import { eq, desc, and, count, sql, asc, lte } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { toCumulativeLP } from "@/lib/rank";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requireUser();

  // Run ALL independent queries in parallel — single round-trip window
  const [
    ddragonVersion,
    recentMatches,
    latestRank,
    activeActionItems,
    inProgressActionItems,
    matchStats,
    upcomingSession,
    activeGoal,
    lastCompletedSession,
  ] = await Promise.all([
    getLatestVersion(),

    // Recent matches (last 10) — no rawMatchJson needed
    db.query.matches.findMany({
      where: eq(matches.userId, user.id),
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
        queueId: true,
      },
    }),

    // Latest rank snapshot (for current rank display)
    db.query.rankSnapshots.findFirst({
      where: eq(rankSnapshots.userId, user.id),
      orderBy: desc(rankSnapshots.capturedAt),
    }),

    // Pending action items
    db.query.coachingActionItems.findMany({
      where: and(
        eq(coachingActionItems.userId, user.id),
        eq(coachingActionItems.status, "pending")
      ),
      limit: 5,
    }),

    // In-progress action items
    db.query.coachingActionItems.findMany({
      where: and(
        eq(coachingActionItems.userId, user.id),
        eq(coachingActionItems.status, "in_progress")
      ),
      limit: 5,
    }),

    // Aggregate stats instead of fetching ALL matches
    db
      .select({
        total: count(
          sql`CASE WHEN ${matches.result} != 'Remake' THEN 1 END`
        ),
        wins: count(
          sql`CASE WHEN ${matches.result} = 'Victory' THEN 1 END`
        ),
        remakes: count(
          sql`CASE WHEN ${matches.result} = 'Remake' THEN 1 END`
        ),
        unreviewed: count(
          sql`CASE WHEN ${matches.reviewed} = 0 AND ${matches.result} != 'Remake' THEN 1 END`
        ),
        // VOD-pending: unreviewed games that already have post-game notes (comment or highlights)
        vodPending: count(
          sql`CASE WHEN ${matches.reviewed} = 0 AND ${matches.result} != 'Remake' AND (
            ${matches.comment} IS NOT NULL
            OR EXISTS (SELECT 1 FROM ${matchHighlights} WHERE ${matchHighlights.matchId} = ${matches.id})
          ) THEN 1 END`
        ),
      })
      .from(matches)
      .where(eq(matches.userId, user.id)),

    // Next upcoming (scheduled) coaching session
    db.query.coachingSessions.findFirst({
      where: and(
        eq(coachingSessions.userId, user.id),
        eq(coachingSessions.status, "scheduled")
      ),
      orderBy: asc(coachingSessions.date),
      columns: {
        id: true,
        coachName: true,
        date: true,
        vodMatchId: true,
      },
    }),

    // Active goal (for dashboard widget)
    db.query.goals.findFirst({
      where: and(eq(goals.userId, user.id), eq(goals.status, "active")),
    }),

    // Last completed coaching session (for "days since" widget)
    db.query.coachingSessions.findFirst({
      where: and(
        eq(coachingSessions.userId, user.id),
        eq(coachingSessions.status, "completed")
      ),
      orderBy: desc(coachingSessions.date),
      columns: {
        id: true,
        coachName: true,
        date: true,
      },
    }),
  ]);

  const latestRankOrUndef = latestRank ?? null;
  const { total, wins, remakes: _remakes, unreviewed, vodPending } = matchStats[0] ?? {
    total: 0,
    wins: 0,
    remakes: 0,
    unreviewed: 0,
    vodPending: 0,
  };
  const postGamePending = unreviewed - vodPending;

  // LP trend: compare first vs. last rank snapshot within the timeframe of
  // the last 10 games, giving a consistent "LP change over recent games"
  // indicator that aligns with the analytics page.
  let lpTrend: number | null = null;
  if (latestRankOrUndef?.tier && recentMatches.length >= 2) {
    // Find the oldest game date in recent matches for the baseline window
    const oldestGameDate = recentMatches[recentMatches.length - 1].gameDate;

    // Baseline: the latest snapshot captured at or before the oldest recent game
    const baseline = await db.query.rankSnapshots.findFirst({
      where: and(
        eq(rankSnapshots.userId, user.id),
        lte(rankSnapshots.capturedAt, oldestGameDate)
      ),
      orderBy: desc(rankSnapshots.capturedAt),
    }) ?? await db.query.rankSnapshots.findFirst({
      // Fall back to the very oldest snapshot if none predates the window
      where: eq(rankSnapshots.userId, user.id),
      orderBy: asc(rankSnapshots.capturedAt),
    });

    if (baseline?.tier && baseline.id !== latestRankOrUndef.id) {
      const newLP = toCumulativeLP(latestRankOrUndef.tier!, latestRankOrUndef.division, latestRankOrUndef.lp || 0);
      const oldLP = toCumulativeLP(baseline.tier, baseline.division, baseline.lp || 0);
      lpTrend = (newLP ?? 0) - (oldLP ?? 0);
    }
  }

  return (
    <DashboardClient
      user={{
        name: user.name,
        riotGameName: user.riotGameName,
        riotTagLine: user.riotTagLine,
        puuid: user.puuid,
      }}
      recentMatches={recentMatches}
      matchStats={{ total, wins, losses: total - wins, unreviewed, postGamePending, vodPending }}
      latestRank={latestRankOrUndef}
      lpTrend={lpTrend}
      actionItems={[...inProgressActionItems, ...activeActionItems]}
      upcomingSession={upcomingSession ?? null}
      activeGoal={activeGoal ?? null}
      lastCompletedSession={lastCompletedSession ?? null}
      currentRank={latestRankOrUndef?.tier ? {
        tier: latestRankOrUndef.tier,
        division: latestRankOrUndef.division,
        lp: latestRankOrUndef.lp ?? 0,
      } : null}
      ddragonVersion={ddragonVersion}
    />
  );
}
