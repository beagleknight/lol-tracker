import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { coachingSessions, matches, matchHighlights } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

import { CompleteSessionClient } from "./complete-session-client";

export default async function CompleteCoachingSessionPage({
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

  // If already completed, redirect to detail view
  if (session.status === "completed") {
    redirect(`/coaching/${sessionId}`);
  }

  // Fetch the VOD match and its highlights + DDragon version
  const [vodMatchRows, ddragonVersion, vodHighlights] = await Promise.all([
    session.vodMatchId
      ? db
          .select({
            id: matches.id,
            gameDate: matches.gameDate,
            result: matches.result,
            championName: matches.championName,
            matchupChampionName: matches.matchupChampionName,
            kills: matches.kills,
            deaths: matches.deaths,
            assists: matches.assists,
            gameDurationSeconds: matches.gameDurationSeconds,
            vodUrl: matches.vodUrl,
          })
          .from(matches)
          .where(
            and(
              eq(matches.id, session.vodMatchId),
              eq(matches.userId, user.id),
              accountScope(matches.riotAccountId, user.activeRiotAccountId),
            ),
          )
      : Promise.resolve([]),
    getLatestVersion(),
    session.vodMatchId
      ? db.query.matchHighlights.findMany({
          where: and(
            eq(matchHighlights.matchId, session.vodMatchId),
            eq(matchHighlights.userId, user.id),
            accountScope(matchHighlights.riotAccountId, user.activeRiotAccountId),
          ),
          columns: {
            type: true,
            text: true,
            topic: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const vodMatch = vodMatchRows[0] || null;
  const highlights = vodHighlights.map((h) => ({
    type: h.type,
    text: h.text,
    topic: h.topic,
  }));

  return (
    <CompleteSessionClient
      session={session}
      vodMatch={vodMatch}
      vodHighlights={highlights}
      ddragonVersion={ddragonVersion}
    />
  );
}
