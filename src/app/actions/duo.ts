"use server";

import { eq, and, isNotNull, desc, sql, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cacheLife, cacheTag } from "next/cache";

import type { RiotMatch } from "@/lib/riot-api";

import { db } from "@/db";
import { matches, users, type MatchResult } from "@/db/schema";
import { duoTag, invalidateDuoBackfillCaches } from "@/lib/cache";
import { duoStatsSelect, championSynergySelect } from "@/lib/match-queries";
import { requireUser } from "@/lib/session";

const PAGE_SIZE = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DuoPartnerInfo {
  id: string;
  name: string | null;
  riotGameName: string | null;
  riotTagLine: string | null;
  puuid: string | null;
}

export interface DuoStats {
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  partnerAvgKills: number;
  partnerAvgDeaths: number;
  partnerAvgAssists: number;
  soloGames: number;
  soloWins: number;
  soloWinRate: number;
}

export interface DuoGameRow {
  id: string;
  gameDate: Date;
  result: MatchResult;
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  gameDurationSeconds: number;
  partnerChampionName: string;
  partnerKills: number;
  partnerDeaths: number;
  partnerAssists: number;
}

export interface ChampionSynergy {
  yourChampion: string;
  partnerChampion: string;
  games: number;
  wins: number;
  winRate: number;
}

// ─── Duo Partner Info (not cached — fast PK lookup, needs duoPartnerUserId) ─

export async function getDuoPartnerInfo(): Promise<DuoPartnerInfo | null> {
  const user = await requireUser();

  if (!user.duoPartnerUserId) return null;

  const partner = await db.query.users.findFirst({
    where: eq(users.id, user.duoPartnerUserId),
    columns: {
      id: true,
      name: true,
      riotGameName: true,
      riotTagLine: true,
      puuid: true,
    },
  });

  return partner || null;
}

// ─── Cached Duo Stats ───────────────────────────────────────────────────────

async function getCachedDuoStats(userId: string): Promise<DuoStats | null> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(duoTag(userId));

  // Check if user has a duo partner configured
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { duoPartnerUserId: true },
  });
  if (!user?.duoPartnerUserId) return null;

  // Run duo + solo aggregations in parallel — excludes remakes from totals
  const [duoAgg, soloAgg] = await Promise.all([
    db
      .select(duoStatsSelect())
      .from(matches)
      .where(and(eq(matches.userId, userId), isNotNull(matches.duoPartnerPuuid))),
    db
      .select({
        totalGames: sql<number>`SUM(CASE WHEN ${matches.result} != 'Remake' THEN 1 ELSE 0 END)`,
        wins: sql<number>`SUM(CASE WHEN ${matches.result} = 'Victory' THEN 1 ELSE 0 END)`,
      })
      .from(matches)
      .where(and(eq(matches.userId, userId), sql`${matches.duoPartnerPuuid} IS NULL`)),
  ]);

  const duo = duoAgg[0];
  if (!duo || duo.totalGames === 0) {
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgKills: 0,
      avgDeaths: 0,
      avgAssists: 0,
      partnerAvgKills: 0,
      partnerAvgDeaths: 0,
      partnerAvgAssists: 0,
      soloGames: 0,
      soloWins: 0,
      soloWinRate: 0,
    };
  }

  const solo = soloAgg[0];
  const totalGames = duo.totalGames;
  const wins = duo.wins ?? 0;

  return {
    totalGames,
    wins,
    losses: totalGames - wins,
    winRate: totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0,
    avgKills: Math.round((duo.avgKills ?? 0) * 10) / 10,
    avgDeaths: Math.round((duo.avgDeaths ?? 0) * 10) / 10,
    avgAssists: Math.round((duo.avgAssists ?? 0) * 10) / 10,
    partnerAvgKills: Math.round((duo.partnerAvgKills ?? 0) * 10) / 10,
    partnerAvgDeaths: Math.round((duo.partnerAvgDeaths ?? 0) * 10) / 10,
    partnerAvgAssists: Math.round((duo.partnerAvgAssists ?? 0) * 10) / 10,
    soloGames: solo?.totalGames ?? 0,
    soloWins: solo?.wins ?? 0,
    soloWinRate:
      solo && solo.totalGames > 0 ? Math.round(((solo.wins ?? 0) / solo.totalGames) * 100) : 0,
  };
}

/** Public wrapper — resolves userId from session, delegates to cached fn. */
export async function getDuoStats(): Promise<DuoStats | null> {
  const user = await requireUser();
  return getCachedDuoStats(user.id);
}

// ─── Cached Duo Games (paginated) ──────────────────────────────────────────

async function getCachedDuoGames(
  userId: string,
  page: number,
): Promise<{ games: DuoGameRow[]; totalPages: number }> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(duoTag(userId));

  // Check if user has a duo partner configured
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { duoPartnerUserId: true },
  });
  if (!user?.duoPartnerUserId) return { games: [], totalPages: 0 };

  const offset = (page - 1) * PAGE_SIZE;
  const duoWhere = and(eq(matches.userId, userId), isNotNull(matches.duoPartnerPuuid));

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(matches).where(duoWhere),
    db
      .select({
        id: matches.id,
        gameDate: matches.gameDate,
        result: matches.result,
        championName: matches.championName,
        kills: matches.kills,
        deaths: matches.deaths,
        assists: matches.assists,
        gameDurationSeconds: matches.gameDurationSeconds,
        duoPartnerChampionName: matches.duoPartnerChampionName,
        duoPartnerKills: matches.duoPartnerKills,
        duoPartnerDeaths: matches.duoPartnerDeaths,
        duoPartnerAssists: matches.duoPartnerAssists,
      })
      .from(matches)
      .where(duoWhere)
      .orderBy(desc(matches.gameDate))
      .limit(PAGE_SIZE)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const games: DuoGameRow[] = rows.map((row) => ({
    id: row.id,
    gameDate: row.gameDate,
    result: row.result,
    championName: row.championName,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
    gameDurationSeconds: row.gameDurationSeconds,
    partnerChampionName: row.duoPartnerChampionName || "Unknown",
    partnerKills: row.duoPartnerKills ?? 0,
    partnerDeaths: row.duoPartnerDeaths ?? 0,
    partnerAssists: row.duoPartnerAssists ?? 0,
  }));

  return { games, totalPages };
}

/** Public wrapper — resolves userId from session, delegates to cached fn. */
export async function getDuoGames(page: number = 1): Promise<{
  games: DuoGameRow[];
  totalPages: number;
}> {
  const user = await requireUser();
  return getCachedDuoGames(user.id, page);
}

// ─── Cached Champion Synergy ────────────────────────────────────────────────

async function getCachedChampionSynergy(userId: string): Promise<ChampionSynergy[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(duoTag(userId));

  // Check if user has a duo partner configured
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { duoPartnerUserId: true },
  });
  if (!user?.duoPartnerUserId) return [];

  const rows = await db
    .select({
      yourChampion: matches.championName,
      partnerChampion: matches.duoPartnerChampionName,
      ...championSynergySelect,
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, userId),
        isNotNull(matches.duoPartnerPuuid),
        isNotNull(matches.duoPartnerChampionName),
      ),
    )
    .groupBy(matches.championName, matches.duoPartnerChampionName)
    .orderBy(sql`games desc`)
    .limit(15);

  return rows
    .filter((r): r is typeof r & { partnerChampion: string } => !!r.partnerChampion)
    .map((r) => ({
      yourChampion: r.yourChampion,
      partnerChampion: r.partnerChampion,
      games: r.games,
      wins: r.wins,
      winRate: r.games > 0 ? Math.round((r.wins / r.games) * 100) : 0,
    }));
}

/** Public wrapper — resolves userId from session, delegates to cached fn. */
export async function getChampionSynergy(): Promise<ChampionSynergy[]> {
  const user = await requireUser();
  return getCachedChampionSynergy(user.id);
}

// ─── Backfill Duo Partner Data ──────────────────────────────────────────────

export async function backfillDuoGames(): Promise<{
  processed: number;
  duoFound: number;
}> {
  const user = await requireUser();
  if (!user.duoPartnerUserId || !user.puuid) {
    return { processed: 0, duoFound: 0 };
  }

  const partner = await db.query.users.findFirst({
    where: eq(users.id, user.duoPartnerUserId),
    columns: { puuid: true },
  });
  if (!partner?.puuid) return { processed: 0, duoFound: 0 };

  const partnerPuuid = partner.puuid;

  // Get all matches with raw JSON that don't already have duo partner set
  const allMatches = await db
    .select({
      id: matches.id,
      rawMatchJson: matches.rawMatchJson,
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, user.id),
        isNotNull(matches.rawMatchJson),
        sql`${matches.duoPartnerPuuid} IS NULL`,
      ),
    );

  let duoFound = 0;

  for (const m of allMatches) {
    if (!m.rawMatchJson) continue;
    try {
      const matchData: RiotMatch = JSON.parse(m.rawMatchJson);
      const participants = matchData.info.participants;

      const player = participants.find((p) => p.puuid === user.puuid);
      if (!player) continue;

      const partnerOnTeam = participants.find(
        (p) => p.puuid === partnerPuuid && p.teamId === player.teamId,
      );

      if (partnerOnTeam) {
        await db
          .update(matches)
          .set({
            duoPartnerPuuid: partnerPuuid,
            duoPartnerChampionName: partnerOnTeam.championName,
            duoPartnerKills: partnerOnTeam.kills,
            duoPartnerDeaths: partnerOnTeam.deaths,
            duoPartnerAssists: partnerOnTeam.assists,
          })
          .where(and(eq(matches.id, m.id), eq(matches.userId, user.id)));
        duoFound++;
      }
    } catch {
      // Skip unparseable matches
    }
  }

  revalidatePath("/duo");
  invalidateDuoBackfillCaches(user.id);
  return { processed: allMatches.length, duoFound };
}
