import { db } from "@/db";
import {
  matches,
  matchHighlights,
  rankSnapshots,
  coachingActionItems,
  coachingSessions,
} from "@/db/schema";
import { eq, desc, and, count, sql, asc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
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
        total: count(),
        wins: count(
          sql`CASE WHEN ${matches.result} = 'Victory' THEN 1 END`
        ),
        unreviewed: count(
          sql`CASE WHEN ${matches.reviewed} = 0 THEN 1 END`
        ),
        // VOD-pending: unreviewed games that already have post-game notes (comment or highlights)
        vodPending: count(
          sql`CASE WHEN ${matches.reviewed} = 0 AND (
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
  ]);

  const latestRankOrUndef = latestRank ?? null;
  const { total, wins, unreviewed, vodPending } = matchStats[0] ?? {
    total: 0,
    wins: 0,
    unreviewed: 0,
    vodPending: 0,
  };
  const postGamePending = unreviewed - vodPending;

  // LP trend: compare latest rank snapshot vs. an older one.
  // Each sync creates 1-2 snapshots (timestamped at sync time, not match time).
  // We skip back ~20 snapshots (~10 syncs) to find the baseline rank, giving
  // a "LP change over recent sessions" indicator.
  let lpTrend: number | null = null;
  if (latestRankOrUndef?.tier && recentMatches.length >= 2) {
    const baseSnapshot = await db.query.rankSnapshots.findFirst({
      where: eq(rankSnapshots.userId, user.id),
      orderBy: desc(rankSnapshots.capturedAt),
      offset: 20,
    });

    // Fall back to the very oldest snapshot if we don't have 20+ yet
    const baseline = baseSnapshot ?? await db.query.rankSnapshots.findFirst({
      where: eq(rankSnapshots.userId, user.id),
      orderBy: asc(rankSnapshots.capturedAt),
    });

    if (baseline?.tier && baseline.id !== latestRankOrUndef.id) {
      const TIER_ORDER = ["IRON", "BRONZE", "SILVER", "GOLD", "PLATINUM", "EMERALD", "DIAMOND", "MASTER", "GRANDMASTER", "CHALLENGER"];
      const DIV_ORDER = ["IV", "III", "II", "I"];
      function toCumLP(tier: string, division: string | null, lp: number) {
        const tierIdx = TIER_ORDER.indexOf(tier.toUpperCase());
        if (tierIdx === -1) return 0;
        const isMaster = tierIdx >= TIER_ORDER.indexOf("MASTER");
        const divIdx = isMaster ? 0 : DIV_ORDER.indexOf(division || "IV");
        return tierIdx * 400 + (divIdx < 0 ? 0 : divIdx) * 100 + lp;
      }
      const newLP = toCumLP(latestRankOrUndef.tier!, latestRankOrUndef.division, latestRankOrUndef.lp || 0);
      const oldLP = toCumLP(baseline.tier, baseline.division, baseline.lp || 0);
      lpTrend = newLP - oldLP;
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
      ddragonVersion={ddragonVersion}
    />
  );
}
