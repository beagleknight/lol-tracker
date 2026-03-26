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
import { invalidateCoachingCaches } from "@/lib/cache";

// ─── Phase 1: Schedule a coaching session ────────────────────────────────────

export async function scheduleCoachingSession(data: {
  coachName: string;
  date: string; // ISO string
  vodMatchId?: string; // optional — user may not have picked a VOD yet
  focusAreas?: string[]; // optional pre-session focus topics
}) {
  const user = await requireUser();

  const session = await db
    .insert(coachingSessions)
    .values({
      userId: user.id,
      coachName: data.coachName,
      date: new Date(data.date),
      status: "scheduled",
      vodMatchId: data.vodMatchId ?? null,
      topics: data.focusAreas?.length ? JSON.stringify(data.focusAreas) : null,
    })
    .returning({ id: coachingSessions.id });

  const sessionId = session[0].id;

  // Link the VOD match if one was selected
  if (data.vodMatchId) {
    await db.insert(coachingSessionMatches).values({
      sessionId,
      matchId: data.vodMatchId,
      userId: user.id,
    });
  }

  revalidatePath("/coaching");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true, sessionId };
}

// ─── Phase 2: Complete a coaching session ────────────────────────────────────

export async function completeCoachingSession(
  sessionId: number,
  data: {
    durationMinutes?: number;
    topics: string[];
    notes?: string;
    actionItems: Array<{ description: string; topic?: string }>;
    additionalMatchIds?: string[];
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

  // Update session to completed
  await db
    .update(coachingSessions)
    .set({
      status: "completed",
      durationMinutes: data.durationMinutes || null,
      topics: JSON.stringify(data.topics),
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(coachingSessions.id, sessionId));

  // Link additional matches discussed (beyond the VOD)
  if (data.additionalMatchIds && data.additionalMatchIds.length > 0) {
    await db.insert(coachingSessionMatches).values(
      data.additionalMatchIds.map((matchId) => ({
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
  revalidatePath(`/coaching/${sessionId}`);
  revalidatePath("/coaching/action-items");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true };
}

// ─── Update / Delete session ─────────────────────────────────────────────────

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
  invalidateCoachingCaches(user.id);

  return { success: true };
}

// ─── Action Items ────────────────────────────────────────────────────────────

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

  // Use "layout" type to revalidate the entire /coaching tree,
  // including /coaching/[id] detail pages that display action items.
  revalidatePath("/coaching", "layout");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

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

  // Use "layout" type to revalidate the entire /coaching tree,
  // including /coaching/[id] detail pages that display action items.
  revalidatePath("/coaching", "layout");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true };
}
