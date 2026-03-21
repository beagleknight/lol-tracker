import { db } from "@/db";
import {
  coachingSessions,
  coachingSessionMatches,
  coachingActionItems,
  matches,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { getLatestVersion } from "@/lib/riot-api";
import { CoachingDetailClient } from "./coaching-detail-client";

export default async function CoachingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const sessionId = parseInt(id);

  if (isNaN(sessionId)) notFound();

  const session = await db.query.coachingSessions.findFirst({
    where: and(
      eq(coachingSessions.id, sessionId),
      eq(coachingSessions.userId, user.id)
    ),
  });

  if (!session) notFound();

  // Parallel: linked matches + action items + DDragon version
  const [linkedMatchRows, items, ddragonVersion] = await Promise.all([
    db
      .select({
        id: matches.id,
        gameDate: matches.gameDate,
        result: matches.result,
        championName: matches.championName,
        matchupChampionName: matches.matchupChampionName,
        kills: matches.kills,
        deaths: matches.deaths,
        assists: matches.assists,
        runeKeystoneName: matches.runeKeystoneName,
        gameDurationSeconds: matches.gameDurationSeconds,
      })
      .from(coachingSessionMatches)
      .innerJoin(matches, and(
        eq(coachingSessionMatches.matchId, matches.id),
        eq(coachingSessionMatches.userId, matches.userId),
      ))
      .where(eq(coachingSessionMatches.sessionId, sessionId)),
    db.query.coachingActionItems.findMany({
      where: eq(coachingActionItems.sessionId, sessionId),
    }),
    getLatestVersion(),
  ]);

  return (
    <CoachingDetailClient
      session={session}
      linkedMatches={linkedMatchRows}
      actionItems={items}
      ddragonVersion={ddragonVersion}
    />
  );
}
