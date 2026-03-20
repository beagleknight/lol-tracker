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

  // Get linked matches
  const linkedMatchRows = await db
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
    .innerJoin(matches, eq(coachingSessionMatches.matchId, matches.id))
    .where(eq(coachingSessionMatches.sessionId, sessionId));

  // Get action items
  const items = await db.query.coachingActionItems.findMany({
    where: eq(coachingActionItems.sessionId, sessionId),
  });

  const ddragonVersion = await getLatestVersion();

  return (
    <CoachingDetailClient
      session={session}
      linkedMatches={linkedMatchRows}
      actionItems={items}
      ddragonVersion={ddragonVersion}
    />
  );
}
