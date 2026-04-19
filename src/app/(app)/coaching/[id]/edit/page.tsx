import { eq, and, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import { coachingSessions, coachingSessionTopics, matches, matchHighlights } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";
import { getDefaultTopics } from "@/lib/topics";

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
      where: and(
        eq(matches.userId, user.id),
        accountScope(matches.riotAccountId, user.activeRiotAccountId),
      ),
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
            accountScope(matchHighlights.riotAccountId, user.activeRiotAccountId),
            inArray(matchHighlights.matchId, matchIds),
          ),
          columns: {
            matchId: true,
            type: true,
            text: true,
            topicId: true,
          },
        })
      : [];

  const allTopics = await getDefaultTopics();
  const topicMap = new Map(allTopics.map((t) => [t.id, t.name]));

  const highlightsByMatch: Record<
    string,
    Array<{
      type: "highlight" | "lowlight";
      text: string;
      topicId: number | null;
      topicName: string | null;
    }>
  > = {};
  for (const h of allHighlights) {
    if (!highlightsByMatch[h.matchId]) highlightsByMatch[h.matchId] = [];
    highlightsByMatch[h.matchId].push({
      type: h.type,
      text: h.text,
      topicId: h.topicId,
      topicName: h.topicId ? (topicMap.get(h.topicId) ?? null) : null,
    });
  }

  // Fetch session topic IDs from join table
  const sessionTopicRows = await db
    .select({ topicId: coachingSessionTopics.topicId })
    .from(coachingSessionTopics)
    .where(eq(coachingSessionTopics.sessionId, sessionId));
  const initialTopicIds = sessionTopicRows.map((r) => r.topicId);

  return (
    <EditSessionClient
      session={session}
      recentMatches={recentMatches}
      ddragonVersion={ddragonVersion}
      highlightsByMatch={highlightsByMatch}
      previousCoaches={previousCoaches.map((c) => c.coachName)}
      topics={allTopics}
      initialTopicIds={initialTopicIds}
    />
  );
}
