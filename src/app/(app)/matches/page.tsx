import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { MatchesClient } from "./matches-client";

export default async function MatchesPage() {
  const user = await requireUser();

  const [userMatches, allHighlights, ddragonVersion] = await Promise.all([
    db.query.matches.findMany({
      where: eq(matches.userId, user.id),
      orderBy: desc(matches.gameDate),
      columns: {
        id: true,
        odometer: true,
        userId: true,
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
        comment: true,
        reviewed: true,
        reviewNotes: true,
        reviewSkippedReason: true,
        vodUrl: true,
        queueId: true,
        syncedAt: true,
        duoPartnerPuuid: true,
      },
    }),
    db.query.matchHighlights.findMany({
      where: eq(matchHighlights.userId, user.id),
      columns: {
        matchId: true,
        type: true,
      },
    }),
    getLatestVersion(),
  ]);

  // Build highlight counts per match
  const highlightCounts: Record<string, { highlights: number; lowlights: number }> = {};
  for (const h of allHighlights) {
    if (!highlightCounts[h.matchId]) {
      highlightCounts[h.matchId] = { highlights: 0, lowlights: 0 };
    }
    if (h.type === "highlight") highlightCounts[h.matchId].highlights++;
    else highlightCounts[h.matchId].lowlights++;
  }

  const isRiotLinked = !!user.puuid;

  return (
    <MatchesClient
      matches={userMatches as any}
      ddragonVersion={ddragonVersion}
      isRiotLinked={isRiotLinked}
      highlightCounts={highlightCounts}
    />
  );
}
