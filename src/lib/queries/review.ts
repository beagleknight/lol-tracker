/**
 * Shared review page queries.
 * Extracted from (app)/review/page.tsx for reuse in (demo)/review/page.tsx.
 */

import { eq, ne, and, asc, desc, count, or, isNull } from "drizzle-orm";

import type { Match } from "@/db/schema";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { accountScope } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";
import { getDefaultTopics } from "@/lib/topics";

import { getDetailedHighlightsByMatch } from "./highlights";

const COMPLETED_PAGE_SIZE = 10;
const VALID_TABS = ["post-game", "vod", "completed"] as const;

export async function getReviewData(
  userId: string,
  activeRiotAccountId: string | null,
  primaryRole: string | null,
  params: { completedPage?: string; tab?: string },
) {
  const completedPage = Math.max(1, parseInt(String(params.completedPage ?? "1"), 10) || 1);
  const tabParam = String(params.tab ?? "post-game");
  const initialTab = VALID_TABS.includes(tabParam as (typeof VALID_TABS)[number])
    ? (tabParam as (typeof VALID_TABS)[number])
    : "post-game";
  const completedOffset = (completedPage - 1) * COMPLETED_PAGE_SIZE;

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
    reviewNotes: true,
    reviewSkippedReason: true,
    vodUrl: true,
    queueId: true,
    syncedAt: true,
    duoPartnerPuuid: true,
    position: true,
  } as const;

  const unreviewedPositionFilter = primaryRole
    ? or(eq(matches.position, primaryRole), isNull(matches.position))
    : undefined;

  const [ddragonVersion, unreviewedMatches, reviewedMatches, reviewedCountResult] =
    await Promise.all([
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
        limit: COMPLETED_PAGE_SIZE,
        offset: completedOffset,
        columns: matchColumns,
      }) as unknown as Promise<Match[]>,
      db.select({ total: count() }).from(matches).where(reviewedWhere),
    ]);

  const completedTotal = reviewedCountResult[0]?.total ?? 0;
  const completedTotalPages = Math.max(1, Math.ceil(completedTotal / COMPLETED_PAGE_SIZE));

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
    completedPage: Math.min(completedPage, completedTotalPages),
    completedTotalPages,
    completedTotal,
    initialTab,
    topics,
  };
}
