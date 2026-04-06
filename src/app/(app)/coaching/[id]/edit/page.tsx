import { eq, and, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { coachingSessions, matches, matchHighlights } from "@/db/schema";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

import { EditSessionClient } from "./edit-session-client";

export default async function EditCoachingSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const sessionId = parseInt(id);

  if (isNaN(sessionId)) notFound();

  const session = await db.query.coachingSessions.findFirst({
    where: and(eq(coachingSessions.id, sessionId), eq(coachingSessions.userId, user.id)),
  });

  if (!session) notFound();

  const [recentMatches, ddragonVersion, previousCoaches] = await Promise.all([
    db.query.matches.findMany({
      where: and(eq(matches.userId, user.id), eq(matches.riotAccountId, user.activeRiotAccountId!)),
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
    db
      .selectDistinct({ coachName: coachingSessions.coachName })
      .from(coachingSessions)
      .where(eq(coachingSessions.userId, user.id)),
  ]);

  // Fetch highlights for match picker preview
  const matchIds = recentMatches.map((m) => m.id);
  const allHighlights =
    matchIds.length > 0
      ? await db.query.matchHighlights.findMany({
          where: and(
            eq(matchHighlights.userId, user.id),
            eq(matchHighlights.riotAccountId, user.activeRiotAccountId!),
            inArray(matchHighlights.matchId, matchIds),
          ),
          columns: {
            matchId: true,
            type: true,
            text: true,
            topic: true,
          },
        })
      : [];

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
    <EditSessionClient
      session={session}
      recentMatches={recentMatches}
      ddragonVersion={ddragonVersion}
      highlightsByMatch={highlightsByMatch}
      previousCoaches={previousCoaches.map((c) => c.coachName)}
    />
  );
}
