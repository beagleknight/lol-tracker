import { db } from "@/db";
import { matches, coachingSessions, rankSnapshots } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const user = await requireUser();

  const [allMatches, sessions, ranks, ddragonVersion] = await Promise.all([
    db.query.matches.findMany({
      where: eq(matches.userId, user.id),
      orderBy: asc(matches.gameDate),
      columns: {
        // Only the 8 columns used by analytics compute functions
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
      where: eq(coachingSessions.userId, user.id),
      orderBy: asc(coachingSessions.date),
      columns: {
        id: true,
        coachName: true,
        date: true,
        status: true,
      },
    }),
    db.query.rankSnapshots.findMany({
      where: eq(rankSnapshots.userId, user.id),
      orderBy: asc(rankSnapshots.capturedAt),
    }),
    getLatestVersion(),
  ]);

  return (
    <AnalyticsClient
      matches={allMatches}
      coachingSessions={sessions}
      rankSnapshots={ranks}
      ddragonVersion={ddragonVersion}
    />
  );
}
