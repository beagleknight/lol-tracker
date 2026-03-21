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
        text: true,
        topic: true,
      },
    }),
    getLatestVersion(),
  ]);

  // Build highlight data per match (full items for preview + counts)
  const highlightsPerMatch: Record<
    string,
    Array<{ type: "highlight" | "lowlight"; text: string; topic: string | null }>
  > = {};
  for (const h of allHighlights) {
    if (!highlightsPerMatch[h.matchId]) {
      highlightsPerMatch[h.matchId] = [];
    }
    highlightsPerMatch[h.matchId].push({
      type: h.type as "highlight" | "lowlight",
      text: h.text,
      topic: h.topic,
    });
  }

  const isRiotLinked = !!user.puuid;

  return (
    <MatchesClient
      matches={userMatches as any}
      ddragonVersion={ddragonVersion}
      isRiotLinked={isRiotLinked}
      highlightsPerMatch={highlightsPerMatch}
    />
  );
}
