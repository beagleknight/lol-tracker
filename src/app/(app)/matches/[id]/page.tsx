import { db } from "@/db";
import { matches, coachingSessionMatches, coachingSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { notFound } from "next/navigation";
import { MatchDetailClient } from "./match-detail-client";
import type { RiotMatch } from "@/lib/riot-api";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const match = await db.query.matches.findFirst({
    where: and(eq(matches.id, id), eq(matches.userId, user.id)),
  });

  if (!match) {
    notFound();
  }

  // Parse raw match JSON if available
  let rawMatch: RiotMatch | null = null;
  if (match.rawMatchJson) {
    try {
      rawMatch = JSON.parse(match.rawMatchJson);
    } catch {
      // ignore parse errors
    }
  }

  // These two are independent — run in parallel
  const [ddragonVersion, linkedSessions] = await Promise.all([
    getLatestVersion(),
    db
      .select({
        sessionId: coachingSessions.id,
        coachName: coachingSessions.coachName,
        date: coachingSessions.date,
      })
      .from(coachingSessionMatches)
      .innerJoin(
        coachingSessions,
        eq(coachingSessionMatches.sessionId, coachingSessions.id)
      )
      .where(eq(coachingSessionMatches.matchId, match.id)),
  ]);

  return (
    <MatchDetailClient
      match={match}
      rawMatch={rawMatch}
      linkedSessions={linkedSessions}
      ddragonVersion={ddragonVersion}
      userPuuid={user.puuid || ""}
    />
  );
}
