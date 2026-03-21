import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
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
        reviewSkippedReason: true,
        vodUrl: true,
        queueId: true,
        syncedAt: true,
        // rawMatchJson excluded — not needed for review list
      },
    }) as unknown as Promise<import("@/db/schema").Match[]>,
  ]);

  // Fetch highlights for all unreviewed matches (filtered by matchId)
  const matchIds = unreviewedMatches.map((m) => m.id);
  const allHighlights =
    matchIds.length > 0
      ? await db
          .select()
          .from(matchHighlights)
          .where(
            and(
              eq(matchHighlights.userId, user.id),
              inArray(matchHighlights.matchId, matchIds),
            )
          )
      : [];

  // Group highlights by matchId
  const highlightsByMatch: Record<
    string,
    Array<{ id: number; type: "highlight" | "lowlight"; text: string; topic: string | null }>
  > = {};
  for (const h of allHighlights) {
    if (!highlightsByMatch[h.matchId]) {
      highlightsByMatch[h.matchId] = [];
    }
    highlightsByMatch[h.matchId].push({
      id: h.id,
      type: h.type as "highlight" | "lowlight",
      text: h.text,
      topic: h.topic,
    });
  }

  return (
    <ReviewClient
      matches={unreviewedMatches}
      highlightsByMatch={highlightsByMatch}
      ddragonVersion={ddragonVersion}
    />
  );
}
