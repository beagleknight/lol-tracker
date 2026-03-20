"use server";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function updateMatchComment(matchId: string, comment: string) {
  const user = await requireUser();

  await db
    .update(matches)
    .set({ comment: comment || null })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  revalidatePath("/matches");
  return { success: true };
}

export async function updateMatchReview(
  matchId: string,
  reviewed: boolean,
  reviewNotes?: string
) {
  const user = await requireUser();

  await db
    .update(matches)
    .set({
      reviewed,
      reviewNotes: reviewNotes || null,
    })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  revalidatePath("/matches");
  revalidatePath("/review");
  return { success: true };
}
