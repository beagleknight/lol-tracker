import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { ReviewClient } from "./review-client";

export default async function ReviewPage() {
  const user = await requireUser();

  // Parallel: DDragon version + unreviewed matches (exclude rawMatchJson)
  const [ddragonVersion, unreviewedMatches] = await Promise.all([
    getLatestVersion(),
    db.query.matches.findMany({
      where: and(
        eq(matches.userId, user.id),
        eq(matches.reviewed, false)
      ),
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
        // rawMatchJson excluded — not needed for review list
      },
    }) as unknown as Promise<import("@/db/schema").Match[]>,
  ]);

  return (
    <ReviewClient
      matches={unreviewedMatches}
      ddragonVersion={ddragonVersion}
    />
  );
}
