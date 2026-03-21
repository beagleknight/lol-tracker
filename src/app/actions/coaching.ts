"use server";

import { db } from "@/db";
import {
  coachingSessions,
  coachingSessionMatches,
  coachingActionItems,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function createCoachingSession(data: {
  coachName: string;
  date: string; // ISO string
  durationMinutes?: number;
  topics: string[];
  notes?: string;
  matchIds: string[];
  actionItems: Array<{ description: string; topic?: string }>;
}) {
  const user = await requireUser();

  const session = await db
    .insert(coachingSessions)
    .values({
      userId: user.id,
      coachName: data.coachName,
      date: new Date(data.date),
      durationMinutes: data.durationMinutes || null,
      topics: JSON.stringify(data.topics),
      notes: data.notes || null,
    })
    .returning({ id: coachingSessions.id });

  const sessionId = session[0].id;

  // Link matches
  if (data.matchIds.length > 0) {
    await db.insert(coachingSessionMatches).values(
      data.matchIds.map((matchId) => ({
        sessionId,
        matchId,
        userId: user.id,
      }))
    );
  }

  // Create action items
  if (data.actionItems.length > 0) {
    await db.insert(coachingActionItems).values(
      data.actionItems.map((item) => ({
        sessionId,
        userId: user.id,
        description: item.description,
        topic: item.topic || null,
      }))
    );
  }

  revalidatePath("/coaching");
  revalidatePath("/dashboard");
  revalidatePath("/coaching/action-items");

  return { success: true, sessionId };
}

export async function updateCoachingSession(
  sessionId: number,
  data: {
    coachName?: string;
    date?: string;
    durationMinutes?: number;
    topics?: string[];
    notes?: string;
  }
) {
  const user = await requireUser();

  const session = await db.query.coachingSessions.findFirst({
    where: and(
      eq(coachingSessions.id, sessionId),
      eq(coachingSessions.userId, user.id)
    ),
  });

  if (!session) {
    return { error: "Session not found." };
  }

  await db
    .update(coachingSessions)
    .set({
      ...(data.coachName && { coachName: data.coachName }),
      ...(data.date && { date: new Date(data.date) }),
      ...(data.durationMinutes !== undefined && {
        durationMinutes: data.durationMinutes,
      }),
      ...(data.topics && { topics: JSON.stringify(data.topics) }),
      ...(data.notes !== undefined && { notes: data.notes }),
      updatedAt: new Date(),
    })
    .where(eq(coachingSessions.id, sessionId));

  revalidatePath("/coaching");
  revalidatePath(`/coaching/${sessionId}`);

  return { success: true };
}

export async function deleteCoachingSession(sessionId: number) {
  const user = await requireUser();

  await db
    .delete(coachingSessions)
    .where(
      and(
        eq(coachingSessions.id, sessionId),
        eq(coachingSessions.userId, user.id)
      )
    );

  revalidatePath("/coaching");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function updateActionItemStatus(
  itemId: number,
  status: "pending" | "in_progress" | "completed"
) {
  const user = await requireUser();

  await db
    .update(coachingActionItems)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : null,
    })
    .where(
      and(
        eq(coachingActionItems.id, itemId),
        eq(coachingActionItems.userId, user.id)
      )
    );

  revalidatePath("/coaching/action-items");
  revalidatePath("/dashboard");

  return { success: true };
}

export async function createActionItem(data: {
  sessionId: number;
  description: string;
  topic?: string;
}) {
  const user = await requireUser();

  await db.insert(coachingActionItems).values({
    sessionId: data.sessionId,
    userId: user.id,
    description: data.description,
    topic: data.topic || null,
  });

  revalidatePath("/coaching/action-items");
  revalidatePath(`/coaching/${data.sessionId}`);
  revalidatePath("/dashboard");

  return { success: true };
}

export async function deleteActionItem(itemId: number) {
  const user = await requireUser();

  await db
    .delete(coachingActionItems)
    .where(
      and(
        eq(coachingActionItems.id, itemId),
        eq(coachingActionItems.userId, user.id)
      )
    );

  revalidatePath("/coaching/action-items");
  revalidatePath("/dashboard");

  return { success: true };
}
