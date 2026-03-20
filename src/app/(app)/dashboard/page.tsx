import { db } from "@/db";
import {
  matches,
  rankSnapshots,
  coachingActionItems,
} from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { DashboardClient } from "./dashboard-client";

export default async function DashboardPage() {
  const user = await requireUser();
  const ddragonVersion = await getLatestVersion();

  // Get recent matches (last 20)
  const recentMatches = await db.query.matches.findMany({
    where: eq(matches.userId, user.id),
    orderBy: desc(matches.gameDate),
    limit: 20,
  });

  // Get latest rank snapshot
  const latestRank = await db.query.rankSnapshots.findFirst({
    where: eq(rankSnapshots.userId, user.id),
    orderBy: desc(rankSnapshots.capturedAt),
  });

  // Get recent rank snapshots for LP trend (last 10)
  const recentSnapshots = await db.query.rankSnapshots.findMany({
    where: eq(rankSnapshots.userId, user.id),
    orderBy: desc(rankSnapshots.capturedAt),
    limit: 10,
  });

  // Get active action items
  const activeActionItems = await db.query.coachingActionItems.findMany({
    where: and(
      eq(coachingActionItems.userId, user.id),
      eq(coachingActionItems.status, "pending")
    ),
    limit: 5,
  });

  const inProgressActionItems = await db.query.coachingActionItems.findMany({
    where: and(
      eq(coachingActionItems.userId, user.id),
      eq(coachingActionItems.status, "in_progress")
    ),
    limit: 5,
  });

  // All matches for overall stats
  const allMatches = await db.query.matches.findMany({
    where: eq(matches.userId, user.id),
    orderBy: desc(matches.gameDate),
  });

  return (
    <DashboardClient
      user={{
        name: user.name,
        riotGameName: user.riotGameName,
        riotTagLine: user.riotTagLine,
        puuid: user.puuid,
      }}
      recentMatches={recentMatches}
      allMatches={allMatches}
      latestRank={latestRank ?? null}
      recentSnapshots={recentSnapshots}
      actionItems={[...inProgressActionItems, ...activeActionItems]}
      ddragonVersion={ddragonVersion}
    />
  );
}
