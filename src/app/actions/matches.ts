"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { invalidateReviewCaches } from "@/lib/cache";
import { blockDemoWrites, blockIfImpersonating, requireUser } from "@/lib/session";
import { validateVodUrl } from "@/lib/url";

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
      topicId?: number;
    }>;
    comment?: string;
    vodUrl?: string;
    reviewed?: boolean;
    reviewNotes?: string;
    reviewSkippedReason?: string;
  },
) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // Save highlights/lowlights
  await db
    .delete(matchHighlights)
    .where(and(eq(matchHighlights.matchId, matchId), eq(matchHighlights.userId, user.id)));

  if (data.highlights.length > 0) {
    await db.insert(matchHighlights).values(
      data.highlights.map((item) => ({
        matchId,
        userId: user.id,
        riotAccountId: user.activeRiotAccountId,
        type: item.type,
        text: item.text,
        topicId: item.topicId ?? null,
      })),
    );
  }

  // Validate VOD URL scheme (reject javascript:, data:, etc.)
  const sanitisedVodUrl = validateVodUrl(data.vodUrl);
  if (data.vodUrl?.trim() && !sanitisedVodUrl) {
    return { error: "Invalid VOD URL. Only http:// and https:// links are allowed." };
  }

  // Update match fields
  await db
    .update(matches)
    .set({
      comment: data.comment || null,
      vodUrl: sanitisedVodUrl,
      reviewed: data.reviewed ?? false,
      reviewNotes: data.reviewNotes || null,
      reviewSkippedReason: data.reviewSkippedReason || null,
    })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  revalidatePath("/matches");
  revalidatePath("/review");
  revalidatePath("/scout");
  revalidatePath("/coaching");
  invalidateReviewCaches(user.id);
  return { success: true };
}

export async function bulkMarkReviewed(skipReason: string) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  const conditions = [eq(matches.userId, user.id), eq(matches.reviewed, false)];
  if (user.activeRiotAccountId) {
    conditions.push(eq(matches.riotAccountId, user.activeRiotAccountId));
  }

  const result = await db
    .update(matches)
    .set({
      reviewed: true,
      reviewSkippedReason: skipReason,
    })
    .where(and(...conditions));

  const count = result.rowsAffected ?? 0;

  revalidatePath("/matches");
  revalidatePath("/review");
  revalidatePath("/scout");
  revalidatePath("/coaching");
  invalidateReviewCaches(user.id);
  return { success: true, count };
}
