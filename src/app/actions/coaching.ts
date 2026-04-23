"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  coachingSessions,
  coachingSessionMatches,
  coachingSessionTopics,
  coachingActionItems,
  topics,
} from "@/db/schema";
import { evaluateAchievements } from "@/lib/achievements";
import { invalidateCoachingCaches } from "@/lib/cache";
import { blockDemoWrites, blockIfImpersonating, requireUser } from "@/lib/session";

// ─── Phase 1: Schedule a coaching session ────────────────────────────────────

export async function scheduleCoachingSession(data: {
  coachName: string;
  date: string; // ISO string
  vodMatchId?: string; // optional — user may not have picked a VOD yet
  focusAreas?: string[]; // optional pre-session focus topics (stored as JSON for now)
}) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  const focusAreasJson = data.focusAreas?.length ? JSON.stringify(data.focusAreas) : null;

  const session = await db
    .insert(coachingSessions)
    .values({
      userId: user.id,
      coachName: data.coachName,
      date: new Date(data.date),
      status: "scheduled",
      vodMatchId: data.vodMatchId ?? null,
      focusAreas: focusAreasJson, // Preserved separately — never overwritten
    })
    .returning({ id: coachingSessions.id });

  const sessionId = session[0].id;

  // Link focus areas as session topics (pre-fill)
  if (data.focusAreas && data.focusAreas.length > 0) {
    const topicRows = await db
      .select({ id: topics.id, name: topics.name })
      .from(topics)
      .where(eq(topics.isDefault, true));
    const topicMap = new Map(topicRows.map((t) => [t.name, t.id]));

    const topicLinks = data.focusAreas
      .map((name) => topicMap.get(name))
      .filter((id): id is number => id !== undefined)
      .map((topicId) => ({ sessionId, topicId }));

    if (topicLinks.length > 0) {
      await db.insert(coachingSessionTopics).values(topicLinks);
    }
  }

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
    topicIds: number[];
    notes?: string;
    actionItems: Array<{ description: string; topicId?: number }>;
    additionalMatchIds?: string[];
  },
) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  const session = await db.query.coachingSessions.findFirst({
    where: and(eq(coachingSessions.id, sessionId), eq(coachingSessions.userId, user.id)),
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
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(coachingSessions.id, sessionId));

  // Replace session topics
  await db.delete(coachingSessionTopics).where(eq(coachingSessionTopics.sessionId, sessionId));
  if (data.topicIds.length > 0) {
    await db.insert(coachingSessionTopics).values(
      data.topicIds.map((topicId) => ({
        sessionId,
        topicId,
      })),
    );
  }

  // Link additional matches discussed (beyond the VOD)
  if (data.additionalMatchIds && data.additionalMatchIds.length > 0) {
    await db.insert(coachingSessionMatches).values(
      data.additionalMatchIds.map((matchId) => ({
        sessionId,
        matchId,
        userId: user.id,
      })),
    );
  }

  // Create action items
  if (data.actionItems.length > 0) {
    await db.insert(coachingActionItems).values(
      data.actionItems.map((item) => ({
        sessionId,
        userId: user.id,
        description: item.description,
        topicId: item.topicId ?? null,
      })),
    );
  }

  revalidatePath("/coaching");
  revalidatePath(`/coaching/${sessionId}`);
  revalidatePath("/coaching/action-items");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  // Evaluate achievements (may unlock coaching-related achievements)
  void evaluateAchievements(user.id);

  return { success: true };
}

// ─── Update / Edit session ───────────────────────────────────────────────────

export async function updateCoachingSession(
  sessionId: number,
  data: {
    coachName: string;
    date: string; // ISO string
    vodMatchId?: string | null;
    topicIds?: number[];
    // Only for completed sessions:
    durationMinutes?: number | null;
    notes?: string | null;
  },
) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  const session = await db.query.coachingSessions.findFirst({
    where: and(eq(coachingSessions.id, sessionId), eq(coachingSessions.userId, user.id)),
  });

  if (!session) {
    return { error: "Session not found." };
  }

  // Update session fields
  await db
    .update(coachingSessions)
    .set({
      coachName: data.coachName,
      date: new Date(data.date),
      vodMatchId: data.vodMatchId ?? null,
      ...(session.status === "completed" && {
        durationMinutes: data.durationMinutes ?? null,
        notes: data.notes ?? null,
      }),
      updatedAt: new Date(),
    })
    .where(eq(coachingSessions.id, sessionId));

  // Replace session topics if provided
  if (data.topicIds !== undefined) {
    await db.delete(coachingSessionTopics).where(eq(coachingSessionTopics.sessionId, sessionId));
    if (data.topicIds.length > 0) {
      await db.insert(coachingSessionTopics).values(
        data.topicIds.map((topicId) => ({
          sessionId,
          topicId,
        })),
      );
    }
  }

  // Update VOD match link: delete old link, insert new if provided
  await db
    .delete(coachingSessionMatches)
    .where(
      and(
        eq(coachingSessionMatches.sessionId, sessionId),
        eq(coachingSessionMatches.userId, user.id),
      ),
    );

  if (data.vodMatchId) {
    await db.insert(coachingSessionMatches).values({
      sessionId,
      matchId: data.vodMatchId,
      userId: user.id,
    });
  }

  revalidatePath("/coaching");
  revalidatePath(`/coaching/${sessionId}`);
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true };
}

// ─── Delete session ──────────────────────────────────────────────────────────

export async function deleteCoachingSession(sessionId: number) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  await db
    .delete(coachingSessions)
    .where(and(eq(coachingSessions.id, sessionId), eq(coachingSessions.userId, user.id)));

  revalidatePath("/coaching");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true };
}

// ─── Action Items ────────────────────────────────────────────────────────────

export async function updateActionItemStatus(itemId: number, status: "active" | "completed") {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  await db
    .update(coachingActionItems)
    .set({
      status,
      completedAt: status === "completed" ? new Date() : null,
    })
    .where(and(eq(coachingActionItems.id, itemId), eq(coachingActionItems.userId, user.id)));

  // Use "page" type to revalidate page components under /coaching without
  // re-rendering the layout tree — "layout" can cause client component
  // remounts that destroy optimistic state (#102).
  revalidatePath("/coaching", "page");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true };
}

export async function deleteActionItem(itemId: number) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  await db
    .delete(coachingActionItems)
    .where(and(eq(coachingActionItems.id, itemId), eq(coachingActionItems.userId, user.id)));

  // Use "page" type to revalidate page components under /coaching without
  // re-rendering the layout tree — "layout" can cause client component
  // remounts that destroy optimistic state (#102).
  revalidatePath("/coaching", "page");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true };
}

// ─── Create standalone action item (not tied to a session) ───────────────────

export async function createActionItem(data: { description: string; topicId?: number }) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  if (!data.description.trim()) {
    return { error: "Description is required." };
  }

  await db.insert(coachingActionItems).values({
    userId: user.id,
    sessionId: null,
    description: data.description.trim(),
    topicId: data.topicId ?? null,
  });

  revalidatePath("/coaching", "page");
  revalidatePath("/dashboard");
  invalidateCoachingCaches(user.id);

  return { success: true };
}
