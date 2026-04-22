import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { coachingActionItems, coachingSessions, matchActionItemOutcomes } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { getDefaultTopics } from "@/lib/topics";

import { ActionItemsClient } from "./action-items-client";

export default async function ActionItemsPage() {
  const user = await requireUser();

  const [items, outcomeCounts, allTopics] = await Promise.all([
    db
      .select({
        id: coachingActionItems.id,
        sessionId: coachingActionItems.sessionId,
        description: coachingActionItems.description,
        topicId: coachingActionItems.topicId,
        status: coachingActionItems.status,
        completedAt: coachingActionItems.completedAt,
        createdAt: coachingActionItems.createdAt,
        coachName: coachingSessions.coachName,
        sessionDate: coachingSessions.date,
      })
      .from(coachingActionItems)
      .leftJoin(coachingSessions, eq(coachingActionItems.sessionId, coachingSessions.id))
      .where(eq(coachingActionItems.userId, user.id))
      .orderBy(coachingActionItems.createdAt),
    db
      .select({
        actionItemId: matchActionItemOutcomes.actionItemId,
        outcome: matchActionItemOutcomes.outcome,
        count: sql<number>`count(*)`.as("count"),
      })
      .from(matchActionItemOutcomes)
      .where(eq(matchActionItemOutcomes.userId, user.id))
      .groupBy(matchActionItemOutcomes.actionItemId, matchActionItemOutcomes.outcome),
    getDefaultTopics(),
  ]);

  // Build a map: actionItemId -> { nailed_it, forgot, unsure, total }
  const outcomeStats: Record<
    number,
    { nailed_it: number; forgot: number; unsure: number; total: number }
  > = {};
  for (const row of outcomeCounts) {
    if (!outcomeStats[row.actionItemId]) {
      outcomeStats[row.actionItemId] = { nailed_it: 0, forgot: 0, unsure: 0, total: 0 };
    }
    const stats = outcomeStats[row.actionItemId];
    stats[row.outcome] = Number(row.count);
    stats.total += Number(row.count);
  }

  return <ActionItemsClient items={items} topicNames={allTopics} outcomeStats={outcomeStats} />;
}
