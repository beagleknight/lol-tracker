// Shared Drizzle SQL fragments for match result filtering and aggregation.
// Keeps all remake-aware query logic in one place.

import { eq, sql, type SQL } from "drizzle-orm";

import { matches, matchHighlights } from "@/db/schema";

// ─── Account Scoping ─────────────────────────────────────────────────────────

/**
 * Builds a SQL condition that scopes a query to a specific Riot account.
 * When `accountId` is null (no account linked), returns `sql\`0\``
 * (always-false) so queries return empty results instead of crashing.
 *
 * Usage: `.where(and(eq(table.userId, userId), accountScope(table.riotAccountId, accountId)))`
 */
export function accountScope(column: Parameters<typeof eq>[0], accountId: string | null): SQL {
  return accountId ? eq(column, accountId) : sql`0`;
}

// ─── SQL Fragments ───────────────────────────────────────────────────────────

/** SQL condition: result is NOT 'Remake'. Use in WHERE clauses. */
export const notRemake: SQL = sql`${matches.result} != 'Remake'`;

// ─── Aggregate Helpers ───────────────────────────────────────────────────────

/**
 * Returns win/loss/remake counts for a result-aware query.
 * Use: `db.select(winLossRemakeSelect).from(matches).where(...)`
 */
export const winLossRemakeSelect = {
  wins: sql<number>`SUM(CASE WHEN ${matches.result} = 'Victory' THEN 1 ELSE 0 END)`.as("wins"),
  losses: sql<number>`SUM(CASE WHEN ${matches.result} = 'Defeat' THEN 1 ELSE 0 END)`.as("losses"),
  remakes: sql<number>`SUM(CASE WHEN ${matches.result} = 'Remake' THEN 1 ELSE 0 END)`.as("remakes"),
};

/**
 * Average performance stats excluding remakes.
 * Use: `db.select(avgPerformanceSelect).from(matches).where(...)`
 */
export const avgPerformanceSelect = {
  avgKills: sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.kills} END)`.as(
    "avg_kills",
  ),
  avgDeaths:
    sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.deaths} END)`.as(
      "avg_deaths",
    ),
  avgAssists:
    sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.assists} END)`.as(
      "avg_assists",
    ),
  avgCsPerMin:
    sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.csPerMin} END)`.as(
      "avg_cs_per_min",
    ),
  avgGold:
    sql<number>`ROUND(AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.goldEarned} END))`.as(
      "avg_gold",
    ),
  avgVision:
    sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.visionScore} END)`.as(
      "avg_vision",
    ),
  total: sql<number>`SUM(CASE WHEN ${matches.result} != 'Remake' THEN 1 ELSE 0 END)`.as(
    "total_meaningful",
  ),
};

/**
 * Duo-specific aggregate counts that exclude remakes from totals.
 */
export function duoStatsSelect() {
  return {
    totalGames: sql<number>`SUM(CASE WHEN ${matches.result} != 'Remake' THEN 1 ELSE 0 END)`.as(
      "total_games",
    ),
    wins: sql<number>`SUM(CASE WHEN ${matches.result} = 'Victory' THEN 1 ELSE 0 END)`.as("wins"),
    avgKills:
      sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.kills} END)`.as(
        "avg_kills",
      ),
    avgDeaths:
      sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.deaths} END)`.as(
        "avg_deaths",
      ),
    avgAssists:
      sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.assists} END)`.as(
        "avg_assists",
      ),
    partnerAvgKills:
      sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.duoPartnerKills} END)`.as(
        "partner_avg_kills",
      ),
    partnerAvgDeaths:
      sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.duoPartnerDeaths} END)`.as(
        "partner_avg_deaths",
      ),
    partnerAvgAssists:
      sql<number>`AVG(CASE WHEN ${matches.result} != 'Remake' THEN ${matches.duoPartnerAssists} END)`.as(
        "partner_avg_assists",
      ),
  };
}

/**
 * Champion synergy counts that exclude remakes.
 */
export const championSynergySelect = {
  games: sql<number>`SUM(CASE WHEN ${matches.result} != 'Remake' THEN 1 ELSE 0 END)`.as("games"),
  wins: sql<number>`SUM(CASE WHEN ${matches.result} = 'Victory' THEN 1 ELSE 0 END)`.as("wins"),
};

/**
 * Sidebar/layout review badge query: counts unreviewed games excluding remakes.
 * When `primaryRole` is provided, off-role matches (position != primaryRole) are excluded.
 * Games with NULL position are always included (unknown = not excluded).
 */
export function sidebarReviewCountsSelect(primaryRole?: string | null) {
  const roleFilter = primaryRole
    ? sql`AND (${matches.position} = ${primaryRole} OR ${matches.position} IS NULL)`
    : sql``;

  return {
    postGame:
      sql<number>`SUM(CASE WHEN ${matches.reviewed} = 0 AND ${matches.result} != 'Remake' ${roleFilter} AND ${matches.comment} IS NULL AND NOT EXISTS (
      SELECT 1 FROM ${matchHighlights} WHERE ${matchHighlights.matchId} = ${matches.id}
    ) THEN 1 ELSE 0 END)`.as("post_game"),
    vod: sql<number>`SUM(CASE WHEN ${matches.reviewed} = 0 AND ${matches.result} != 'Remake' ${roleFilter} AND (
      ${matches.comment} IS NOT NULL
      OR EXISTS (SELECT 1 FROM ${matchHighlights} WHERE ${matchHighlights.matchId} = ${matches.id})
    ) THEN 1 ELSE 0 END)`.as("vod"),
  };
}
