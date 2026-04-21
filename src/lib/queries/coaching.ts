/**
 * Shared coaching hub queries.
 * Extracted from (app)/coaching/page.tsx for reuse in (demo)/coaching/page.tsx.
 */

import { eq, desc, and, gt, lte, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  coachingSessions,
  coachingActionItems,
  coachingSessionTopics,
  matches,
  matchHighlights,
  topics,
} from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { isMeaningful } from "@/lib/match-result";
import { getLatestVersion } from "@/lib/riot-api";
import { getDefaultTopics } from "@/lib/topics";

export async function getCoachingData(userId: string, riotAccountId: string | null) {
  const [allSessions, allActionItems, ddragonVersion] = await Promise.all([
    db.query.coachingSessions.findMany({
      where: eq(coachingSessions.userId, userId),
      orderBy: desc(coachingSessions.date),
    }),
    db.query.coachingActionItems.findMany({
      where: eq(coachingActionItems.userId, userId),
    }),
    getLatestVersion(),
  ]);

  const scheduledSessions = allSessions.filter((s) => s.status === "scheduled");
  const completedSessions = allSessions.filter((s) => s.status === "completed");

  const vodMatchIds = scheduledSessions.map((s) => s.vodMatchId).filter(Boolean) as string[];
  const vodMatches =
    vodMatchIds.length > 0
      ? await db.query.matches.findMany({
          where: and(
            eq(matches.userId, userId),
            accountScope(matches.riotAccountId, riotAccountId),
            inArray(matches.id, vodMatchIds),
          ),
          columns: { id: true, championName: true, matchupChampionName: true, result: true },
        })
      : [];
  const vodMatchMap = Object.fromEntries(vodMatches.map((m) => [m.id, m]));

  const actionItemsBySession = new Map<number, { total: number; completed: number }>();
  for (const item of allActionItems) {
    if (item.sessionId == null) continue;
    const existing = actionItemsBySession.get(item.sessionId) || { total: 0, completed: 0 };
    existing.total++;
    if (item.status === "completed") existing.completed++;
    actionItemsBySession.set(item.sessionId, existing);
  }

  const activeActionItems = allActionItems.filter((i) => i.status !== "completed");

  const sortedCompleted = [...completedSessions].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const intervalsData: Record<
    number,
    { matchCount: number; wins: number; losses: number; relevantNoteCount: number }
  > = {};

  if (sortedCompleted.length > 0) {
    const topicIdsBySession = new Map<number, Set<number>>();
    for (const item of allActionItems) {
      if (item.topicId && item.sessionId != null) {
        const set = topicIdsBySession.get(item.sessionId) || new Set();
        set.add(item.topicId);
        topicIdsBySession.set(item.sessionId, set);
      }
    }

    for (let i = 0; i < sortedCompleted.length; i++) {
      const current = sortedCompleted[i];
      const next = sortedCompleted[i + 1];
      const endDate = next?.date || new Date();

      const intervalMatches = await db.query.matches.findMany({
        where: and(
          eq(matches.userId, userId),
          accountScope(matches.riotAccountId, riotAccountId),
          gt(matches.gameDate, current.date),
          lte(matches.gameDate, endDate),
        ),
        columns: { id: true, result: true },
      });

      const meaningfulGames = intervalMatches.filter((m) => isMeaningful(m.result));
      const wins = meaningfulGames.filter((m) => m.result === "Victory").length;
      const losses = meaningfulGames.length - wins;

      let relevantNoteCount = 0;
      const sessionTopics = topicIdsBySession.get(current.id);
      if (sessionTopics && sessionTopics.size > 0 && intervalMatches.length > 0) {
        const intervalMatchIds = intervalMatches.map((m) => m.id);
        const intervalHighlights = await db.query.matchHighlights.findMany({
          where: and(
            eq(matchHighlights.userId, userId),
            accountScope(matchHighlights.riotAccountId, riotAccountId),
            inArray(matchHighlights.matchId, intervalMatchIds),
          ),
          columns: { topicId: true },
        });
        relevantNoteCount = intervalHighlights.filter(
          (h) => h.topicId && sessionTopics.has(h.topicId),
        ).length;
      }

      intervalsData[current.id] = {
        matchCount: meaningfulGames.length,
        wins,
        losses,
        relevantNoteCount,
      };
    }
  }

  const allTopics = await getDefaultTopics();
  const allSessionIds = allSessions.map((s) => s.id);
  const sessionTopicRows =
    allSessionIds.length > 0
      ? await db
          .select({
            sessionId: coachingSessionTopics.sessionId,
            topicName: topics.name,
          })
          .from(coachingSessionTopics)
          .innerJoin(topics, eq(coachingSessionTopics.topicId, topics.id))
          .where(inArray(coachingSessionTopics.sessionId, allSessionIds))
      : [];
  const sessionTopics: Record<number, string[]> = {};
  for (const row of sessionTopicRows) {
    if (!sessionTopics[row.sessionId]) sessionTopics[row.sessionId] = [];
    sessionTopics[row.sessionId].push(row.topicName);
  }

  return {
    scheduledSessions,
    completedSessions,
    activeActionItems,
    actionItemsBySession: Object.fromEntries(actionItemsBySession),
    vodMatchMap,
    intervalsData,
    ddragonVersion,
    sessionTopics,
    topicNames: allTopics,
  };
}
