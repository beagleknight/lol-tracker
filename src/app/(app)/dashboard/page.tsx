import { db } from "@/db";
import {
  matches,
  rankSnapshots,
  coachingActionItems,
} from "@/db/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requireUser();

  // Run ALL independent queries in parallel — single round-trip window
  const [
    ddragonVersion,
    recentMatches,
    recentSnapshots,
    activeActionItems,
    inProgressActionItems,
    matchStats,
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

    // Rank snapshots (last 10) — latestRank is just [0]
    db.query.rankSnapshots.findMany({
      where: eq(rankSnapshots.userId, user.id),
      orderBy: desc(rankSnapshots.capturedAt),
      limit: 10,
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
      })
      .from(matches)
      .where(eq(matches.userId, user.id)),
  ]);

  const latestRank = recentSnapshots[0] ?? null;
  const { total, wins, unreviewed } = matchStats[0] ?? {
    total: 0,
    wins: 0,
    unreviewed: 0,
  };

  return (
    <DashboardClient
      user={{
        name: user.name,
        riotGameName: user.riotGameName,
        riotTagLine: user.riotTagLine,
        puuid: user.puuid,
      }}
      recentMatches={recentMatches}
      matchStats={{ total, wins, losses: total - wins, unreviewed }}
      latestRank={latestRank}
      recentSnapshots={recentSnapshots}
      actionItems={[...inProgressActionItems, ...activeActionItems]}
      ddragonVersion={ddragonVersion}
    />
  );
}
