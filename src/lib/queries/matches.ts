/**
 * Shared matches list queries.
 * Extracted from (app)/matches/page.tsx for reuse in (demo)/matches/page.tsx.
 */

import { eq, and, desc, sql, count } from "drizzle-orm";

import { db } from "@/db";
import { matches, type Match } from "@/db/schema";
import { winLossRemakeSelect } from "@/lib/match-queries";
import { getLatestVersion } from "@/lib/riot-api";

import { getHighlightsPerMatch } from "./highlights";

const PAGE_SIZE = 10;

export interface MatchesFilters {
  search: string;
  result: string;
  champion: string;
  review: string;
}

export async function getMatchesData(
  userId: string,
  accountId: string | null,
  page: number,
  filters: MatchesFilters,
) {
  const { search, result, champion, review } = filters;

  // Build WHERE conditions
  const conditions = [
    eq(matches.userId, userId),
    accountId ? eq(matches.riotAccountId, accountId) : sql`0`,
  ];
  if (result === "Victory" || result === "Defeat" || result === "Remake") {
    conditions.push(eq(matches.result, result));
  }
  if (champion !== "all") {
    conditions.push(eq(matches.championName, champion));
  }
  if (review === "reviewed") {
    conditions.push(eq(matches.reviewed, true));
  } else if (review === "unreviewed") {
    conditions.push(eq(matches.reviewed, false));
  } else if (review === "has-notes") {
    conditions.push(sql`${matches.comment} IS NOT NULL AND ${matches.comment} != ''`);
  }
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      sql`(
        ${matches.championName} LIKE ${pattern}
        OR ${matches.matchupChampionName} LIKE ${pattern}
        OR ${matches.runeKeystoneName} LIKE ${pattern}
        OR ${matches.comment} LIKE ${pattern}
        OR ${matches.reviewNotes} LIKE ${pattern}
      )`,
    );
  }

  const whereClause = and(...conditions);
  const offset = (page - 1) * PAGE_SIZE;

  const [pageMatches, countResult, championRows, ddragonVersion, statsResult] = await Promise.all([
    db.query.matches.findMany({
      where: whereClause,
      orderBy: desc(matches.gameDate),
      limit: PAGE_SIZE,
      offset,
      columns: {
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
      },
    }),
    db.select({ total: count() }).from(matches).where(whereClause),
    db
      .selectDistinct({ championName: matches.championName })
      .from(matches)
      .where(
        and(eq(matches.userId, userId), accountId ? eq(matches.riotAccountId, accountId) : sql`0`),
      ),
    getLatestVersion(),
    db.select(winLossRemakeSelect).from(matches).where(whereClause),
  ]);

  const totalMatches = countResult[0]?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalMatches / PAGE_SIZE));
  const champions = championRows.map((r) => r.championName).sort();
  const wins = statsResult[0]?.wins ?? 0;
  const losses = statsResult[0]?.losses ?? 0;

  const highlightsPerMatch = await getHighlightsPerMatch(
    userId,
    accountId,
    pageMatches.map((m) => m.id),
  );

  return {
    matches: pageMatches as Match[],
    ddragonVersion,
    highlightsPerMatch,
    currentPage: Math.min(page, totalPages),
    totalPages,
    totalMatches,
    wins,
    losses,
    champions,
    filters: { search, result, champion, review },
  };
}
