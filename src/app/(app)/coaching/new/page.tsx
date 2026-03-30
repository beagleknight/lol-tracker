import { eq, desc, inArray } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchHighlights, coachingSessions } from "@/db/schema";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

import { ScheduleSessionClient } from "./schedule-session-client";

export default async function ScheduleCoachingSessionPage() {
  const user = await requireUser();

  const [recentMatches, ddragonVersion, previousCoaches] = await Promise.all([
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
    // Get distinct coach names for autocomplete
    db
      .selectDistinct({ coachName: coachingSessions.coachName })
      .from(coachingSessions)
      .where(eq(coachingSessions.userId, user.id)),
  ]);

  // Fetch highlights only for the 50 recent matches
  const matchIds = recentMatches.map((m) => m.id);
  const allHighlights =
    matchIds.length > 0
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
    Array<{
      type: "highlight" | "lowlight";
      text: string;
      topic: string | null;
    }>
  > = {};
  for (const h of allHighlights) {
    if (!highlightsByMatch[h.matchId]) highlightsByMatch[h.matchId] = [];
    highlightsByMatch[h.matchId].push({
      type: h.type,
      text: h.text,
      topic: h.topic,
    });
  }

  return (
    <ScheduleSessionClient
      recentMatches={recentMatches}
      ddragonVersion={ddragonVersion}
      highlightsByMatch={highlightsByMatch}
      previousCoaches={previousCoaches.map((c) => c.coachName)}
    />
  );
}
