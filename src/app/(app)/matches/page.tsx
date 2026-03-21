import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { MatchesClient } from "./matches-client";

export default async function MatchesPage() {
  const user = await requireUser();

  const [userMatches, ddragonVersion] = await Promise.all([
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
        queueId: true,
        syncedAt: true,
      },
    }),
    getLatestVersion(),
  ]);

  const isRiotLinked = !!user.puuid;

  return (
    <MatchesClient
      matches={userMatches as any}
      ddragonVersion={ddragonVersion}
      isRiotLinked={isRiotLinked}
    />
  );
}
