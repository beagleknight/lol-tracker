import { db } from "@/db";
import {
  coachingSessions,
  coachingActionItems,
  matches,
  matchHighlights,
} from "@/db/schema";
import { eq, desc, and, gt, lte, inArray } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { getLatestVersion } from "@/lib/riot-api";
import { cacheLife, cacheTag } from "next/cache";
import { coachingTag } from "@/lib/cache";
import { CoachingHubClient } from "./coaching-hub-client";

async function getCachedCoachingHubData(userId: string) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(coachingTag(userId));

  // Fetch all sessions, action items, and DDragon version in parallel
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

  const scheduledSessions = allSessions.filter(
    (s) => s.status === "scheduled"
  );
  const completedSessions = allSessions.filter(
    (s) => s.status === "completed"
  );

  // Get VOD match details for scheduled sessions
  const vodMatchIds = scheduledSessions
    .map((s) => s.vodMatchId)
    .filter(Boolean) as string[];
  const vodMatches =
    vodMatchIds.length > 0
      ? await db.query.matches.findMany({
          where: and(
            eq(matches.userId, userId),
            inArray(matches.id, vodMatchIds)
          ),
          columns: {
            id: true,
            championName: true,
            matchupChampionName: true,
            result: true,
          },
        })
      : [];
  const vodMatchMap = Object.fromEntries(vodMatches.map((m) => [m.id, m]));

  // Build action items by session map
  const actionItemsBySession = new Map<
    number,
    { total: number; completed: number }
  >();
  for (const item of allActionItems) {
    const existing = actionItemsBySession.get(item.sessionId) || {
      total: 0,
      completed: 0,
    };
    existing.total++;
    if (item.status === "completed") existing.completed++;
    actionItemsBySession.set(item.sessionId, existing);
  }

  // Active action items (pending + in_progress)
  const activeActionItems = allActionItems.filter(
    (i) => i.status !== "completed"
  );

  // For completed sessions: compute "between sessions" match data
  // Sort completed sessions ascending by date for interval computation
  const sortedCompleted = [...completedSessions].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  // Build intervals: each completed session -> matches between it and the next
  type SessionInterval = {
    sessionId: number;
    matchCount: number;
    wins: number;
    losses: number;
    relevantNoteCount: number;
  };

  const intervals: Map<number, SessionInterval> = new Map();

  if (sortedCompleted.length > 0) {
    // Collect all action item topics per session for matching
    const topicsBySession = new Map<number, Set<string>>();
    for (const item of allActionItems) {
      if (item.topic) {
        const set = topicsBySession.get(item.sessionId) || new Set();
        set.add(item.topic);
        topicsBySession.set(item.sessionId, set);
      }
    }

    // For each completed session, find matches in the interval after it
    for (let i = 0; i < sortedCompleted.length; i++) {
      const current = sortedCompleted[i];
      const next = sortedCompleted[i + 1];
      const endDate = next?.date || new Date();

      const intervalMatches = await db.query.matches.findMany({
        where: and(
          eq(matches.userId, userId),
          gt(matches.gameDate, current.date),
          lte(matches.gameDate, endDate)
        ),
        columns: {
          id: true,
          result: true,
        },
      });

      const wins = intervalMatches.filter(
        (m) => m.result === "Victory"
      ).length;
      const losses = intervalMatches.length - wins;

      // Count relevant highlights in these matches
      let relevantNoteCount = 0;
      const sessionTopics = topicsBySession.get(current.id);
      if (sessionTopics && sessionTopics.size > 0 && intervalMatches.length > 0) {
        const intervalMatchIds = intervalMatches.map((m) => m.id);
        const intervalHighlights = await db.query.matchHighlights.findMany({
          where: and(
            eq(matchHighlights.userId, userId),
            inArray(matchHighlights.matchId, intervalMatchIds)
          ),
          columns: { topic: true },
        });
        relevantNoteCount = intervalHighlights.filter(
          (h) => h.topic && sessionTopics.has(h.topic)
        ).length;
      }

      intervals.set(current.id, {
        sessionId: current.id,
        matchCount: intervalMatches.length,
        wins,
        losses,
        relevantNoteCount,
      });
    }
  }

  // Serialize intervals for client
  const intervalsData: Record<
    number,
    { matchCount: number; wins: number; losses: number; relevantNoteCount: number }
  > = {};
  for (const [sessionId, data] of intervals) {
    intervalsData[sessionId] = {
      matchCount: data.matchCount,
      wins: data.wins,
      losses: data.losses,
      relevantNoteCount: data.relevantNoteCount,
    };
  }

  return {
    scheduledSessions,
    completedSessions,
    activeActionItems,
    actionItemsBySession: Object.fromEntries(actionItemsBySession),
    vodMatchMap,
    intervalsData,
    ddragonVersion,
  };
}

export default async function CoachingHubPage() {
  const user = await requireUser();
  const data = await getCachedCoachingHubData(user.id);

  return (
    <CoachingHubClient
      scheduledSessions={data.scheduledSessions}
      completedSessions={data.completedSessions}
      activeActionItems={data.activeActionItems}
      actionItemsBySession={data.actionItemsBySession}
      vodMatchMap={data.vodMatchMap}
      intervalsData={data.intervalsData}
      ddragonVersion={data.ddragonVersion}
    />
  );
}
