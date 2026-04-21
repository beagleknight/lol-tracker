/**
 * Shared highlights-per-match query.
 * Eliminates 3x duplication across dashboard, matches, and review pages.
 */

import { eq, and, inArray } from "drizzle-orm";

import { db } from "@/db";
import { matchHighlights, topics } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";

export type HighlightItem = {
  type: "highlight" | "lowlight";
  text: string;
  topicName: string | null;
};

export type HighlightsPerMatch = Record<string, HighlightItem[]>;

/**
 * Fetch highlights for a set of match IDs, grouped by matchId.
 * Returns an empty object if no matchIds are provided.
 */
export async function getHighlightsPerMatch(
  userId: string,
  riotAccountId: string | null,
  matchIds: string[],
): Promise<HighlightsPerMatch> {
  if (matchIds.length === 0) return {};

  const rows = await db
    .select({
      matchId: matchHighlights.matchId,
      type: matchHighlights.type,
      text: matchHighlights.text,
      topicName: topics.name,
    })
    .from(matchHighlights)
    .leftJoin(topics, eq(matchHighlights.topicId, topics.id))
    .where(
      and(
        eq(matchHighlights.userId, userId),
        accountScope(matchHighlights.riotAccountId, riotAccountId),
        inArray(matchHighlights.matchId, matchIds),
      ),
    );

  const result: HighlightsPerMatch = {};
  for (const h of rows) {
    if (!result[h.matchId]) result[h.matchId] = [];
    result[h.matchId].push({
      type: h.type,
      text: h.text,
      topicName: h.topicName,
    });
  }
  return result;
}

/**
 * Fetch highlights for a set of match IDs with full detail (includes id, topicId).
 * Used by the review page which needs these fields for editing.
 */
export type DetailedHighlightItem = {
  id: number;
  type: "highlight" | "lowlight";
  text: string;
  topicId?: number;
  topicName?: string;
};

export type DetailedHighlightsByMatch = Record<string, DetailedHighlightItem[]>;

export async function getDetailedHighlightsByMatch(
  userId: string,
  riotAccountId: string | null,
  matchIds: string[],
): Promise<DetailedHighlightsByMatch> {
  if (matchIds.length === 0) return {};

  const rows = await db
    .select({
      id: matchHighlights.id,
      matchId: matchHighlights.matchId,
      type: matchHighlights.type,
      text: matchHighlights.text,
      topicId: matchHighlights.topicId,
      topicName: topics.name,
    })
    .from(matchHighlights)
    .leftJoin(topics, eq(matchHighlights.topicId, topics.id))
    .where(
      and(
        eq(matchHighlights.userId, userId),
        accountScope(matchHighlights.riotAccountId, riotAccountId),
        inArray(matchHighlights.matchId, matchIds),
      ),
    );

  const result: DetailedHighlightsByMatch = {};
  for (const h of rows) {
    if (!result[h.matchId]) result[h.matchId] = [];
    result[h.matchId].push({
      id: h.id,
      type: h.type,
      text: h.text,
      topicId: h.topicId ?? undefined,
      topicName: h.topicName ?? undefined,
    });
  }
  return result;
}
