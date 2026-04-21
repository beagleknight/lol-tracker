/**
 * Shared match detail queries.
 * Extracted from (app)/matches/[id]/page.tsx for reuse in (demo)/matches/[id]/page.tsx.
 */

import { eq, and } from "drizzle-orm";

import type { RiotMatch } from "@/lib/riot-api";

import { checkAiConfigured, getCachedInsight } from "@/app/actions/ai-insights";
import { getMatchupNotesForMatch } from "@/app/actions/matchup-notes";
import { db } from "@/db";
import {
  matches,
  matchHighlights,
  coachingSessionMatches,
  coachingSessions,
  topics,
} from "@/db/schema";
import { getLatestVersion } from "@/lib/riot-api";

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

export async function getMatchDetailData(
  matchId: string,
  userId: string,
  activeRiotAccountId: string | null,
  userPuuid: string | null,
  options?: { skipAuthDependentQueries?: boolean },
) {
  const ddragonVersionPromise = getLatestVersion();

  const match = await db.query.matches.findFirst({
    where: and(
      eq(matches.id, matchId),
      eq(matches.userId, userId),
      activeRiotAccountId ? eq(matches.riotAccountId, activeRiotAccountId) : undefined,
    ),
  });

  if (!match) return null;

  // Parse raw match JSON
  let participants: ReturnType<typeof slimParticipants> | null = null;
  let matchPuuid = userPuuid || "";
  if (match.rawMatchJson) {
    try {
      const rawMatch: RiotMatch = JSON.parse(match.rawMatchJson);
      participants = slimParticipants(rawMatch);

      if (userPuuid) {
        const puuidInMatch = rawMatch.info.participants.some((p) => p.puuid === userPuuid);
        if (!puuidInMatch && match.championName) {
          const byChampion = rawMatch.info.participants.find(
            (p) => p.championName === match.championName,
          );
          if (byChampion) matchPuuid = byChampion.puuid;
        }
      }
    } catch {
      // ignore parse errors
    }
  }

  const { rawMatchJson: _rawJson, ...matchForClient } = match;

  const [
    ddragonVersion,
    linkedSessions,
    highlights,
    matchupNotesData,
    aiConfigured,
    cachedAiInsight,
  ] = await Promise.all([
    ddragonVersionPromise,
    db
      .select({
        sessionId: coachingSessions.id,
        coachName: coachingSessions.coachName,
        date: coachingSessions.date,
      })
      .from(coachingSessionMatches)
      .innerJoin(coachingSessions, eq(coachingSessionMatches.sessionId, coachingSessions.id))
      .where(
        and(
          eq(coachingSessionMatches.matchId, match.id),
          eq(coachingSessionMatches.userId, userId),
        ),
      ),
    db
      .select({
        type: matchHighlights.type,
        text: matchHighlights.text,
        topicId: matchHighlights.topicId,
        topicName: topics.name,
      })
      .from(matchHighlights)
      .leftJoin(topics, eq(matchHighlights.topicId, topics.id))
      .where(
        and(
          eq(matchHighlights.matchId, match.id),
          eq(matchHighlights.userId, userId),
          activeRiotAccountId ? eq(matchHighlights.riotAccountId, activeRiotAccountId) : undefined,
        ),
      ),
    match.matchupChampionName && !options?.skipAuthDependentQueries
      ? getMatchupNotesForMatch(match.championName, match.matchupChampionName)
      : Promise.resolve([]),
    checkAiConfigured(),
    options?.skipAuthDependentQueries
      ? Promise.resolve(null)
      : getCachedInsight("post-game", { matchId: match.id }),
  ]);

  const highlightItems = highlights.map((h) => ({
    type: h.type,
    text: h.text,
    topicId: h.topicId ?? undefined,
    topicName: h.topicName ?? undefined,
  }));

  return {
    match: matchForClient,
    participants,
    linkedSessions,
    highlights: highlightItems,
    matchupNotes: matchupNotesData,
    ddragonVersion,
    userPuuid: matchPuuid,
    aiConfigured,
    cachedAiInsight,
  };
}
