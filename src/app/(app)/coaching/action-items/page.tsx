import { eq } from "drizzle-orm";

import { db } from "@/db";
import { coachingActionItems, coachingSessions } from "@/db/schema";
import { requireUser } from "@/lib/session";

import { ActionItemsClient } from "./action-items-client";

export default async function ActionItemsPage() {
  const user = await requireUser();

  const items = await db
    .select({
      id: coachingActionItems.id,
      sessionId: coachingActionItems.sessionId,
      description: coachingActionItems.description,
      topic: coachingActionItems.topic,
      status: coachingActionItems.status,
      completedAt: coachingActionItems.completedAt,
      createdAt: coachingActionItems.createdAt,
      coachName: coachingSessions.coachName,
      sessionDate: coachingSessions.date,
    })
    .from(coachingActionItems)
    .leftJoin(coachingSessions, eq(coachingActionItems.sessionId, coachingSessions.id))
    .where(eq(coachingActionItems.userId, user.id))
    .orderBy(coachingActionItems.createdAt);

  return <ActionItemsClient items={items} />;
}
