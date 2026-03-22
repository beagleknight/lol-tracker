import { db } from "@/db";
import { matches, matchHighlights, coachingSessionMatches, coachingSessions } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { notFound } from "next/navigation";
import { MatchDetailClient } from "./match-detail-client";
import type { RiotMatch } from "@/lib/riot-api";

/** Slim participant shape — only the fields used by the client component */
function slimParticipants(raw: RiotMatch) {
  return raw.info.participants.map((p) => ({
    puuid: p.puuid,
    teamId: p.teamId,
    championName: p.championName,
    riotIdGameName: p.riotIdGameName,
    summonerName: p.summonerName,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    totalMinionsKilled: p.totalMinionsKilled,
    neutralMinionsKilled: p.neutralMinionsKilled,
    visionScore: p.visionScore,
    goldEarned: p.goldEarned,
    totalDamageDealtToChampions: p.totalDamageDealtToChampions,
    item0: p.item0,
    item1: p.item1,
    item2: p.item2,
    item3: p.item3,
    item4: p.item4,
    item5: p.item5,
    item6: p.item6,
  }));
}

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Start DDragon version fetch immediately — it doesn't depend on the match
  const ddragonVersionPromise = getLatestVersion();

  const match = await db.query.matches.findFirst({
    where: and(eq(matches.id, id), eq(matches.userId, user.id)),
  });

  if (!match) {
    notFound();
  }

  // Parse raw match JSON and extract only the fields the client needs
  let participants: ReturnType<typeof slimParticipants> | null = null;
  if (match.rawMatchJson) {
    try {
      const rawMatch: RiotMatch = JSON.parse(match.rawMatchJson);
      participants = slimParticipants(rawMatch);
    } catch {
      // ignore parse errors
    }
  }

  // Strip rawMatchJson before passing to client — saves 50-100KB from RSC payload
  const { rawMatchJson: _stripped, ...matchForClient } = match;

  // These are independent — run in parallel (ddragonVersion already started above)
  const [ddragonVersion, linkedSessions, highlights] = await Promise.all([
    ddragonVersionPromise,
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
      .where(and(
        eq(coachingSessionMatches.matchId, match.id),
        eq(coachingSessionMatches.userId, user.id),
      )),
    db
      .select()
      .from(matchHighlights)
      .where(
        and(
          eq(matchHighlights.matchId, match.id),
          eq(matchHighlights.userId, user.id),
        )
      ),
  ]);

  const highlightItems = highlights.map((h) => ({
    type: h.type as "highlight" | "lowlight",
    text: h.text,
    topic: h.topic || undefined,
  }));

  return (
    <MatchDetailClient
      match={matchForClient}
      participants={participants}
      linkedSessions={linkedSessions}
      highlights={highlightItems}
      ddragonVersion={ddragonVersion}
      userPuuid={user.puuid || ""}
    />
  );
}
