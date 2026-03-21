"use server";

import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function updateMatchComment(matchId: string, comment: string) {
  const user = await requireUser();

  await db
    .update(matches)
    .set({ comment: comment || null })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  revalidatePath("/matches");
  revalidatePath("/scout");
  return { success: true };
}

export async function updateMatchReview(
  matchId: string,
  reviewed: boolean,
  reviewNotes?: string,
  reviewSkippedReason?: string
) {
  const user = await requireUser();

  await db
    .update(matches)
    .set({
      reviewed,
      reviewNotes: reviewNotes || null,
      reviewSkippedReason: reviewSkippedReason || null,
    })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  revalidatePath("/matches");
  revalidatePath("/review");
  revalidatePath("/scout");
  return { success: true };
}

export async function updateMatchVodUrl(matchId: string, vodUrl: string) {
  const user = await requireUser();

  await db
    .update(matches)
    .set({ vodUrl: vodUrl || null })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  revalidatePath("/matches");
  revalidatePath("/scout");
  revalidatePath("/coaching");
  return { success: true };
}

export async function saveMatchHighlights(
  matchId: string,
  items: Array<{ type: "highlight" | "lowlight"; text: string; topic?: string }>
) {
  const user = await requireUser();

  // Delete existing highlights for this match, then insert new ones
  await db
    .delete(matchHighlights)
    .where(
      and(
        eq(matchHighlights.matchId, matchId),
        eq(matchHighlights.userId, user.id)
      )
    );

  if (items.length > 0) {
    await db.insert(matchHighlights).values(
      items.map((item) => ({
        matchId,
        userId: user.id,
        type: item.type,
        text: item.text,
        topic: item.topic || null,
      }))
    );
  }

  revalidatePath("/matches");
  revalidatePath("/review");
  revalidatePath("/scout");
  revalidatePath("/coaching");
  return { success: true };
}

export async function getMatchHighlights(matchId: string) {
  const user = await requireUser();

  const highlights = await db
    .select()
    .from(matchHighlights)
    .where(
      and(
        eq(matchHighlights.matchId, matchId),
        eq(matchHighlights.userId, user.id)
      )
    )
    .orderBy(matchHighlights.createdAt);

  return highlights;
}

/**
 * Save a complete post-game review in one action:
 * highlights/lowlights, comment, VOD url, and review status.
 */
export async function savePostGameReview(
  matchId: string,
  data: {
    highlights: Array<{
      type: "highlight" | "lowlight";
      text: string;
      topic?: string;
    }>;
    comment?: string;
    vodUrl?: string;
    reviewed?: boolean;
    reviewNotes?: string;
    reviewSkippedReason?: string;
  }
) {
  const user = await requireUser();

  // Save highlights/lowlights
  await db
    .delete(matchHighlights)
    .where(
      and(
        eq(matchHighlights.matchId, matchId),
        eq(matchHighlights.userId, user.id)
      )
    );

  if (data.highlights.length > 0) {
    await db.insert(matchHighlights).values(
      data.highlights.map((item) => ({
        matchId,
        userId: user.id,
        type: item.type,
        text: item.text,
        topic: item.topic || null,
      }))
    );
  }

  // Update match fields
  await db
    .update(matches)
    .set({
      comment: data.comment || null,
      vodUrl: data.vodUrl || null,
      reviewed: data.reviewed ?? false,
      reviewNotes: data.reviewNotes || null,
      reviewSkippedReason: data.reviewSkippedReason || null,
    })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  revalidatePath("/matches");
  revalidatePath("/review");
  revalidatePath("/scout");
  revalidatePath("/coaching");
  return { success: true };
}

export async function bulkMarkReviewed(skipReason: string) {
  const user = await requireUser();

  const result = await db
    .update(matches)
    .set({
      reviewed: true,
      reviewSkippedReason: skipReason,
    })
    .where(
      and(eq(matches.userId, user.id), eq(matches.reviewed, false))
    );

  const count = result.rowsAffected ?? 0;

  revalidatePath("/matches");
  revalidatePath("/review");
  revalidatePath("/scout");
  revalidatePath("/coaching");
  return { success: true, count };
}
