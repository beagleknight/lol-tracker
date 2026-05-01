/**
 * Shared scout page queries.
 * Extracted from (app)/scout/page.tsx for reuse in (demo)/scout/page.tsx.
 */

import { and, eq, sql } from "drizzle-orm";

import { checkAiConfigured } from "@/app/actions/ai-insights";
import { getAllChampionNames, type ChampionPickCount } from "@/app/actions/live";
import { db } from "@/db";
import { matches } from "@/db/schema";
import { getLatestVersion } from "@/lib/riot-api";

/**
 * Query most-played champions for a given user directly (no auth check).
 * Mirrors getCachedMostPlayedChampions in live.ts but without "use cache".
 */
async function queryMostPlayed(
  userId: string,
  riotAccountId: string | null,
  limit: number,
): Promise<ChampionPickCount[]> {
  const conditions = [eq(matches.userId, userId)];
  if (riotAccountId) {
    conditions.push(eq(matches.riotAccountId, riotAccountId));
  }

  return db
    .select({
      name: matches.championName,
      games: sql<number>`count(*)`.as("games"),
    })
    .from(matches)
    .where(and(...conditions))
    .groupBy(matches.championName)
    .orderBy(sql`count(*) desc`)
    .limit(limit);
}

/**
 * Query most-faced opponents for a given user directly (no auth check).
 * Mirrors getCachedMostFacedOpponents in live.ts but without "use cache".
 */
async function queryMostFaced(
  userId: string,
  riotAccountId: string | null,
  limit: number,
): Promise<ChampionPickCount[]> {
  const conditions = [eq(matches.userId, userId), sql`${matches.matchupChampionName} is not null`];
  if (riotAccountId) {
    conditions.push(eq(matches.riotAccountId, riotAccountId));
  }

  const rows = await db
    .select({
      name: matches.matchupChampionName,
      games: sql<number>`count(*)`.as("games"),
    })
    .from(matches)
    .where(and(...conditions))
    .groupBy(matches.matchupChampionName)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.filter((r): r is ChampionPickCount => !!r.name);
}

export async function getScoutData(
  isRiotLinked: boolean,
  params: { your?: string; enemy?: string },
  /** When provided, queries are scoped to this user without calling requireUser(). */
  userScope?: { userId: string; riotAccountId: string | null },
) {
  const [ddragonVersion, allChampions, mostPlayed, mostFaced, aiConfigured] = await Promise.all([
    getLatestVersion(),
    getAllChampionNames(),
    userScope
      ? queryMostPlayed(userScope.userId, userScope.riotAccountId, 8)
      : // Dynamically import to avoid pulling requireUser() at module level
        import("@/app/actions/live").then((m) => m.getMostPlayedChampions(8)),
    userScope
      ? queryMostFaced(userScope.userId, userScope.riotAccountId, 8)
      : import("@/app/actions/live").then((m) => m.getMostFacedOpponents(8)),
    checkAiConfigured(),
  ]);

  return {
    ddragonVersion,
    allChampions,
    isRiotLinked,
    initialYourChampion: params.your || mostPlayed[0]?.name || "",
    initialEnemyChampion: params.enemy || "",
    mostPlayed,
    mostFaced,
    isAiConfigured: aiConfigured,
  };
}
