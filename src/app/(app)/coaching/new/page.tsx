import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { NewSessionClient } from "./new-session-client";

export default async function NewCoachingSessionPage() {
  const user = await requireUser();

  const [recentMatches, ddragonVersion] = await Promise.all([
    db.query.matches.findMany({
      where: eq(matches.userId, user.id),
      orderBy: desc(matches.gameDate),
      limit: 50,
      columns: {
        id: true,
        gameDate: true,
        championName: true,
        result: true,
        matchupChampionName: true,
        kills: true,
        deaths: true,
        assists: true,
        vodUrl: true,
      },
    }),
    getLatestVersion(),
  ]);

  // Fetch highlights only for the 50 recent matches (not all user highlights)
  const matchIds = recentMatches.map((m) => m.id);
  const allHighlights = matchIds.length > 0
    ? await db.query.matchHighlights.findMany({
        where: inArray(matchHighlights.matchId, matchIds),
        columns: {
          matchId: true,
          type: true,
          text: true,
          topic: true,
        },
      })
    : [];

  // Group highlights by matchId
  const highlightsByMatch: Record<
    string,
    Array<{ type: "highlight" | "lowlight"; text: string; topic: string | null }>
  > = {};
  for (const h of allHighlights) {
    if (!highlightsByMatch[h.matchId]) highlightsByMatch[h.matchId] = [];
    highlightsByMatch[h.matchId].push({
      type: h.type as "highlight" | "lowlight",
      text: h.text,
      topic: h.topic,
    });
  }

  return (
    <NewSessionClient
      recentMatches={recentMatches}
      ddragonVersion={ddragonVersion}
      highlightsByMatch={highlightsByMatch}
    />
  );
}
