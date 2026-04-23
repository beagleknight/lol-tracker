"use server";

import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { matches, matchHighlights, matchActionItemOutcomes } from "@/db/schema";
import { evaluateAchievements } from "@/lib/achievements";
import { invalidateReviewCaches } from "@/lib/cache";
import { blockDemoWrites, blockIfImpersonating, requireUser } from "@/lib/session";
import { validateVodUrl } from "@/lib/url";

/**
 * Save a complete review in a single pass:
 * topic-based highlights, markdown notes, VOD url, and action item outcomes.
 * Saving always marks the match as reviewed.
 */
export async function saveReview(
  matchId: string,
  data: {
    highlights: Array<{
      type: "highlight" | "lowlight";
      topicId: number;
      text?: string | null;
    }>;
    comment?: string;
    vodUrl?: string;
    outcomes?: Array<{
      actionItemId: number;
      outcome: "nailed_it" | "forgot" | "unsure";
    }>;
  },
) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // Save highlights/lowlights (topic-based, text optional)
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
        text: item.text ?? null,
        topicId: item.topicId,
      })),
    );
  }

  // Validate VOD URL scheme (reject javascript:, data:, etc.)
  const sanitisedVodUrl = validateVodUrl(data.vodUrl);
  if (data.vodUrl?.trim() && !sanitisedVodUrl) {
    return { error: "Invalid VOD URL. Only http:// and https:// links are allowed." };
  }

  // Update match — always mark as reviewed
  await db
    .update(matches)
    .set({
      comment: data.comment || null,
      vodUrl: sanitisedVodUrl,
      reviewed: true,
    })
    .where(and(eq(matches.id, matchId), eq(matches.userId, user.id)));

  // Save action item outcomes
  if (data.outcomes && data.outcomes.length > 0) {
    // Delete existing outcomes for this match
    await db
      .delete(matchActionItemOutcomes)
      .where(
        and(
          eq(matchActionItemOutcomes.matchId, matchId),
          eq(matchActionItemOutcomes.userId, user.id),
        ),
      );

    await db.insert(matchActionItemOutcomes).values(
      data.outcomes.map((o) => ({
        matchId,
        actionItemId: o.actionItemId,
        userId: user.id,
        outcome: o.outcome,
      })),
    );
  }

  revalidatePath("/matches");
  revalidatePath("/review");
  revalidatePath("/scout");
  revalidatePath("/coaching");
  invalidateReviewCaches(user.id);

  // Evaluate achievements (may unlock review-related achievements)
  void evaluateAchievements(user.id);

  return { success: true };
}
