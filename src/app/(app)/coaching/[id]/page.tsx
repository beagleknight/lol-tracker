import { eq, and, gt, lte, asc } from "drizzle-orm";
import { notFound } from "next/navigation";

import { db } from "@/db";
import {
  coachingSessions,
  coachingSessionMatches,
  coachingActionItems,
  matches,
  matchHighlights,
} from "@/db/schema";
import { getLatestVersion } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

import { CoachingDetailClient } from "./coaching-detail-client";

export default async function CoachingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const sessionId = parseInt(id);

  if (isNaN(sessionId)) notFound();

  const session = await db.query.coachingSessions.findFirst({
    where: and(eq(coachingSessions.id, sessionId), eq(coachingSessions.userId, user.id)),
  });

  if (!session) notFound();

  // Parallel: linked matches + action items + DDragon version + highlights
  const [linkedMatchRows, items, ddragonVersion, allHighlights] = await Promise.all([
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
        vodUrl: matches.vodUrl,
      })
      .from(coachingSessionMatches)
      .innerJoin(
        matches,
        and(
          eq(coachingSessionMatches.matchId, matches.id),
          eq(coachingSessionMatches.userId, matches.userId),
        ),
      )
      .where(eq(coachingSessionMatches.sessionId, sessionId)),
    db.query.coachingActionItems.findMany({
      where: eq(coachingActionItems.sessionId, sessionId),
    }),
    getLatestVersion(),
    // Highlights via join on sessionId
    db
      .select({
        matchId: matchHighlights.matchId,
        type: matchHighlights.type,
        text: matchHighlights.text,
        topic: matchHighlights.topic,
      })
      .from(coachingSessionMatches)
      .innerJoin(
        matchHighlights,
        and(
          eq(coachingSessionMatches.matchId, matchHighlights.matchId),
          eq(coachingSessionMatches.userId, matchHighlights.userId),
        ),
      )
      .where(
        and(
          eq(coachingSessionMatches.sessionId, sessionId),
          eq(coachingSessionMatches.userId, user.id),
        ),
      ),
  ]);

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

  // For completed sessions: fetch "progress since" data
  // Matches between this session's date and the next session's date (or now)
  let progressMatches: Array<{
    id: string;
    gameDate: Date;
    result: string;
    championName: string;
    matchupChampionName: string | null;
    kills: number;
    deaths: number;
    assists: number;
    gameDurationSeconds: number;
  }> = [];
  const progressHighlightsByMatch: Record<
    string,
    Array<{
      type: "highlight" | "lowlight";
      text: string;
      topic: string | null;
    }>
  > = {};

  if (session.status === "completed") {
    // Find the next session after this one
    const nextSession = await db.query.coachingSessions.findFirst({
      where: and(eq(coachingSessions.userId, user.id), gt(coachingSessions.date, session.date)),
      orderBy: asc(coachingSessions.date),
      columns: { date: true },
    });

    const endDate = nextSession?.date || new Date();

    // Fetch matches between this session and the next
    const conditions = [
      eq(matches.userId, user.id),
      gt(matches.gameDate, session.date),
      lte(matches.gameDate, endDate),
    ];

    progressMatches = await db.query.matches.findMany({
      where: and(...conditions),
      orderBy: asc(matches.gameDate),
      columns: {
        id: true,
        gameDate: true,
        result: true,
        championName: true,
        matchupChampionName: true,
        kills: true,
        deaths: true,
        assists: true,
        gameDurationSeconds: true,
      },
    });

    // Fetch highlights for progress matches
    if (progressMatches.length > 0) {
      const { inArray } = await import("drizzle-orm");
      const progressMatchIds = progressMatches.map((m) => m.id);
      const progressHL = await db.query.matchHighlights.findMany({
        where: and(
          eq(matchHighlights.userId, user.id),
          inArray(matchHighlights.matchId, progressMatchIds),
        ),
        columns: {
          matchId: true,
          type: true,
          text: true,
          topic: true,
        },
      });

      for (const h of progressHL) {
        if (!progressHighlightsByMatch[h.matchId]) progressHighlightsByMatch[h.matchId] = [];
        progressHighlightsByMatch[h.matchId].push({
          type: h.type,
          text: h.text,
          topic: h.topic,
        });
      }
    }
  }

  return (
    <CoachingDetailClient
      session={session}
      linkedMatches={linkedMatchRows}
      actionItems={items}
      ddragonVersion={ddragonVersion}
      highlightsByMatch={highlightsByMatch}
      progressMatches={progressMatches}
      progressHighlightsByMatch={progressHighlightsByMatch}
    />
  );
}
