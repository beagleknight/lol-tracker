/**
 * Shared review page queries.
 * Extracted from (app)/review/page.tsx for reuse in (demo)/review/page.tsx.
 */

import { eq, ne, and, asc, desc, count, or, isNull } from "drizzle-orm";

import type { Match } from "@/db/schema";

import { db } from "@/db";
import { matches, coachingActionItems } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";
import { getDefaultTopics } from "@/lib/topics";

import { getDetailedHighlightsByMatch } from "./highlights";

const REVIEWED_PAGE_SIZE = 10;
const VALID_TABS = ["pending", "reviewed"] as const;

export async function getReviewData(
  userId: string,
  activeRiotAccountId: string | null,
  primaryRole: string | null,
  params: { reviewedPage?: string; tab?: string },
) {
  const reviewedPage = Math.max(1, parseInt(String(params.reviewedPage ?? "1"), 10) || 1);
  const tabParam = String(params.tab ?? "pending");
  const initialTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? (tabParam as (typeof VALID_TABS)[number])
    : "pending";
  const reviewedOffset = (reviewedPage - 1) * REVIEWED_PAGE_SIZE;

  const reviewedWhere = and(
    eq(matches.userId, userId),
    accountScope(matches.riotAccountId, activeRiotAccountId),
    eq(matches.reviewed, true),
    ne(matches.result, "Remake"),
  );

  const matchColumns = {
    id: true,
    odometer: true,
    userId: true,
    gameDate: true,
    result: true,
    championId: true,
    championName: true,
    runeKeystoneId: true,
    runeKeystoneName: true,
    matchupChampionId: true,
    matchupChampionName: true,
    kills: true,
    deaths: true,
    assists: true,
    cs: true,
    csPerMin: true,
    gameDurationSeconds: true,
    goldEarned: true,
    visionScore: true,
    comment: true,
    reviewed: true,
    vodUrl: true,
    queueId: true,
    syncedAt: true,
    duoPartnerPuuid: true,
    position: true,
  } as const;

  const unreviewedPositionFilter = primaryRole
    ? or(eq(matches.position, primaryRole), isNull(matches.position))
    : undefined;

  const [
    ddragonVersion,
    unreviewedMatches,
    reviewedMatches,
    reviewedCountResult,
    activeActionItems,
  ] = await Promise.all([
    getLatestVersion(),
    db.query.matches.findMany({
      where: and(
        eq(matches.userId, userId),
        accountScope(matches.riotAccountId, activeRiotAccountId),
        eq(matches.reviewed, false),
        ne(matches.result, "Remake"),
        unreviewedPositionFilter,
      ),
      orderBy: asc(matches.gameDate),
      limit: 50,
      columns: matchColumns,
    }) as unknown as Promise<Match[]>,
    db.query.matches.findMany({
      where: reviewedWhere,
      orderBy: desc(matches.gameDate),
      limit: REVIEWED_PAGE_SIZE,
      offset: reviewedOffset,
      columns: matchColumns,
    }) as unknown as Promise<Match[]>,
    db.select({ total: count() }).from(matches).where(reviewedWhere),
    // Fetch active action items for the check-in during review
    db.query.coachingActionItems.findMany({
      where: and(eq(coachingActionItems.userId, userId), eq(coachingActionItems.status, "active")),
      columns: { id: true, description: true, topicId: true, createdAt: true },
    }),
  ]);

  const reviewedTotal = reviewedCountResult[0]?.total ?? 0;
  const reviewedTotalPages = Math.max(1, Math.ceil(reviewedTotal / REVIEWED_PAGE_SIZE));

  const allMatchIds = [...unreviewedMatches.map((m) => m.id), ...reviewedMatches.map((m) => m.id)];
  const highlightsByMatch = await getDetailedHighlightsByMatch(
    userId,
    activeRiotAccountId,
    allMatchIds,
  );

  const topics = (await getDefaultTopics()).map((t) => ({ id: t.id, name: t.name }));

  return {
    unreviewedMatches,
    reviewedMatches,
    highlightsByMatch,
    ddragonVersion,
    reviewedPage: Math.min(reviewedPage, reviewedTotalPages),
    reviewedTotalPages,
    reviewedTotal,
    initialTab,
    topics,
    activeActionItems,
  };
}
