"use server";

import { db } from "@/db";
import { matches, matchHighlights } from "@/db/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import {
  getChampionIdMap,
  type RiotMatch,
} from "@/lib/riot-api";
import { cacheLife, cacheTag } from "next/cache";
import { scoutTag } from "@/lib/cache";

// ─── Types ───────────────────────────────────────────────────────────────────

interface MatchupGameDetail {
  matchId: string;
  gameDate: Date;
  result: "Victory" | "Defeat";
  championName: string;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  csPerMin: number;
  goldEarned: number;
  visionScore: number;
  gameDurationSeconds: number;
  runeKeystoneName: string | null;
  items: number[];
  comment: string | null;
  reviewed: boolean;
  reviewNotes: string | null;
  vodUrl: string | null;
  duoPartnerPuuid: string | null;
  duoPartnerChampionName: string | null;
  highlights: Array<{
    type: "highlight" | "lowlight";
    text: string;
    topic: string | null;
  }>;
}

interface RuneBreakdown {
  keystoneName: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

interface DuoPairStats {
  yourChampion: string;
  duoChampion: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number;
}

export interface MatchupReport {
  matchupChampionName: string;
  record: { wins: number; losses: number; total: number; winRate: number };
  lastPlayed: Date | null;
  runeBreakdown: RuneBreakdown[];
  avgStats: {
    kills: number;
    deaths: number;
    assists: number;
    csPerMin: number;
    goldEarned: number;
    visionScore: number;
  };
  overallAvgStats: {
    kills: number;
    deaths: number;
    assists: number;
    csPerMin: number;
    goldEarned: number;
    visionScore: number;
    games: number;
  };
  duoPairs: DuoPairStats[];
  games: MatchupGameDetail[];
}

// ─── getMatchupReport ───────────────────────────────────────────────────────

/**
 * Build a full scouting report for a specific matchup champion.
 * Optionally filter by your own champion for champion-vs-champion stats.
 * Queries all of the user's matches against that champion and aggregates stats.
 */
async function getCachedMatchupReport(
  userId: string,
  userPuuid: string | null,
  matchupChampionName: string,
  yourChampionName: string | undefined
): Promise<MatchupReport | null> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(scoutTag(userId));

  // Build where conditions
  const conditions = [
    eq(matches.userId, userId),
    eq(matches.matchupChampionName, matchupChampionName),
  ];
  if (yourChampionName) {
    conditions.push(eq(matches.championName, yourChampionName));
  }

  // Get all matches against this champion, newest first
  const matchRows = await db
    .select()
    .from(matches)
    .where(and(...conditions))
    .orderBy(desc(matches.gameDate));

  if (matchRows.length === 0) {
    return null;
  }

  // Build record
  const wins = matchRows.filter((m) => m.result === "Victory").length;
  const losses = matchRows.length - wins;
  const record = {
    wins,
    losses,
    total: matchRows.length,
    winRate: Math.round((wins / matchRows.length) * 100),
  };

  // Last played
  const lastPlayed = matchRows[0].gameDate;

  // Rune breakdown by keystone
  const runeMap = new Map<
    string,
    { games: number; wins: number; losses: number }
  >();
  for (const m of matchRows) {
    const rune = m.runeKeystoneName || "Unknown";
    const existing = runeMap.get(rune) || { games: 0, wins: 0, losses: 0 };
    existing.games++;
    if (m.result === "Victory") existing.wins++;
    else existing.losses++;
    runeMap.set(rune, existing);
  }
  const runeBreakdown: RuneBreakdown[] = Array.from(runeMap.entries())
    .map(([keystoneName, stats]) => ({
      keystoneName,
      ...stats,
      winRate: Math.round((stats.wins / stats.games) * 100),
    }))
    .sort((a, b) => b.games - a.games);

  // Average stats
  const totalKills = matchRows.reduce((sum, m) => sum + m.kills, 0);
  const totalDeaths = matchRows.reduce((sum, m) => sum + m.deaths, 0);
  const totalAssists = matchRows.reduce((sum, m) => sum + m.assists, 0);
  const totalCsPerMin = matchRows.reduce(
    (sum, m) => sum + (m.csPerMin || 0),
    0
  );
  const totalGold = matchRows.reduce((sum, m) => sum + (m.goldEarned || 0), 0);
  const totalVision = matchRows.reduce(
    (sum, m) => sum + (m.visionScore || 0),
    0
  );
  const n = matchRows.length;

  const avgStats = {
    kills: Math.round((totalKills / n) * 10) / 10,
    deaths: Math.round((totalDeaths / n) * 10) / 10,
    assists: Math.round((totalAssists / n) * 10) / 10,
    csPerMin: Math.round((totalCsPerMin / n) * 10) / 10,
    goldEarned: Math.round(totalGold / n),
    visionScore: Math.round((totalVision / n) * 10) / 10,
  };

  // Individual game details — extract items from rawMatchJson
  // Also fetch highlights for all matches in one query
  const matchIds = matchRows.map((m) => m.id);
  const allHighlights = matchIds.length > 0
    ? await db
        .select()
        .from(matchHighlights)
        .where(
          and(
            eq(matchHighlights.userId, userId),
            inArray(matchHighlights.matchId, matchIds),
          )
        )
    : [];

  // Group highlights by matchId
  const highlightsByMatch = new Map<
    string,
    Array<{ type: "highlight" | "lowlight"; text: string; topic: string | null }>
  >();
  for (const h of allHighlights) {
    const list = highlightsByMatch.get(h.matchId) || [];
    list.push({
      type: h.type as "highlight" | "lowlight",
      text: h.text,
      topic: h.topic,
    });
    highlightsByMatch.set(h.matchId, list);
  }

  const games: MatchupGameDetail[] = matchRows.map((m) => {
    let items: number[] = [0, 0, 0, 0, 0, 0, 0];

    if (m.rawMatchJson) {
      try {
        const raw: RiotMatch = JSON.parse(m.rawMatchJson);
        const participant = raw.info.participants.find(
          (p) => p.puuid === userPuuid
        );
        if (participant) {
          items = [
            participant.item0,
            participant.item1,
            participant.item2,
            participant.item3,
            participant.item4,
            participant.item5,
            participant.item6,
          ];
        }
      } catch {
        // Ignore parse errors, use default empty items
      }
    }

    return {
      matchId: m.id,
      gameDate: m.gameDate,
      result: m.result as "Victory" | "Defeat",
      championName: m.championName,
      matchupChampionName: m.matchupChampionName ?? null,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      cs: m.cs,
      csPerMin: m.csPerMin || 0,
      goldEarned: m.goldEarned || 0,
      visionScore: m.visionScore || 0,
      gameDurationSeconds: m.gameDurationSeconds,
      runeKeystoneName: m.runeKeystoneName,
      items,
      comment: m.comment,
      reviewed: m.reviewed,
      reviewNotes: m.reviewNotes,
      vodUrl: m.vodUrl ?? null,
      duoPartnerPuuid: m.duoPartnerPuuid ?? null,
      duoPartnerChampionName: m.duoPartnerChampionName ?? null,
      highlights: highlightsByMatch.get(m.id) || [],
    };
  });

  // ─── Overall average stats (for comparison baseline) ────────────────────
  // If yourChampionName is set, compare against all games as that champion.
  // Otherwise, compare against all user games.
  const overallConditions = [eq(matches.userId, userId)];
  if (yourChampionName) {
    overallConditions.push(eq(matches.championName, yourChampionName));
  }

  const [overallRow] = await db
    .select({
      avgKills: sql<number>`ROUND(AVG(${matches.kills}), 1)`,
      avgDeaths: sql<number>`ROUND(AVG(${matches.deaths}), 1)`,
      avgAssists: sql<number>`ROUND(AVG(${matches.assists}), 1)`,
      avgCsPerMin: sql<number>`ROUND(AVG(${matches.csPerMin}), 1)`,
      avgGold: sql<number>`ROUND(AVG(${matches.goldEarned}))`,
      avgVision: sql<number>`ROUND(AVG(${matches.visionScore}), 1)`,
      total: sql<number>`COUNT(*)`,
    })
    .from(matches)
    .where(and(...overallConditions));

  const overallAvgStats = {
    kills: overallRow?.avgKills ?? 0,
    deaths: overallRow?.avgDeaths ?? 0,
    assists: overallRow?.avgAssists ?? 0,
    csPerMin: overallRow?.avgCsPerMin ?? 0,
    goldEarned: overallRow?.avgGold ?? 0,
    visionScore: overallRow?.avgVision ?? 0,
    games: overallRow?.total ?? 0,
  };

  // ─── Duo pair aggregation ───────────────────────────────────────────────
  const duoPairMap = new Map<
    string,
    { yourChampion: string; duoChampion: string; games: number; wins: number }
  >();
  for (const g of games) {
    if (g.duoPartnerPuuid && g.duoPartnerChampionName) {
      const key = `${g.championName}|${g.duoPartnerChampionName}`;
      const existing = duoPairMap.get(key) || {
        yourChampion: g.championName,
        duoChampion: g.duoPartnerChampionName,
        games: 0,
        wins: 0,
      };
      existing.games++;
      if (g.result === "Victory") existing.wins++;
      duoPairMap.set(key, existing);
    }
  }
  const duoPairs: DuoPairStats[] = Array.from(duoPairMap.values())
    .map((p) => ({
      ...p,
      losses: p.games - p.wins,
      winRate: Math.round((p.wins / p.games) * 100),
    }))
    .sort((a, b) => b.games - a.games);

  return {
    matchupChampionName,
    record,
    lastPlayed,
    runeBreakdown,
    avgStats,
    overallAvgStats,
    duoPairs,
    games,
  };
}

/** Public wrapper — resolves userId from session, delegates to cached fn. */
export async function getMatchupReport(
  matchupChampionName: string,
  yourChampionName?: string
): Promise<MatchupReport | null> {
  const user = await requireUser();
  return getCachedMatchupReport(
    user.id,
    user.puuid ?? null,
    matchupChampionName,
    yourChampionName
  );
}

// ─── getAllChampionNames ────────────────────────────────────────────────────

/**
 * Get a sorted list of ALL champion names from DDragon.
 * Used to populate searchable champion comboboxes.
 * Cached with "days" lifetime since DDragon champion list changes infrequently.
 */
async function getCachedAllChampionNames(): Promise<string[]> {
  "use cache: remote";
  cacheLife("days");
  // No cacheTag — DDragon data is global, not per-user. Revalidates on TTL only.

  const championMap = await getChampionIdMap();
  return Array.from(championMap.values()).sort();
}

export async function getAllChampionNames(): Promise<string[]> {
  return getCachedAllChampionNames();
}

// ─── getChampionPickCounts ─────────────────────────────────────────────────

export interface ChampionPickCount {
  name: string;
  games: number;
}

/**
 * Get the user's most-played champions, sorted by game count descending.
 * Returns top `limit` champions (default 10).
 */
async function getCachedMostPlayedChampions(
  userId: string,
  limit: number
): Promise<ChampionPickCount[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(scoutTag(userId));

  const rows = await db
    .select({
      name: matches.championName,
      games: sql<number>`count(*)`.as("games"),
    })
    .from(matches)
    .where(eq(matches.userId, userId))
    .groupBy(matches.championName)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows;
}

export async function getMostPlayedChampions(
  limit = 10
): Promise<ChampionPickCount[]> {
  const user = await requireUser();
  return getCachedMostPlayedChampions(user.id, limit);
}

/**
 * Get the opponents the user has faced most often, sorted by game count descending.
 * Returns top `limit` opponents (default 10).
 */
async function getCachedMostFacedOpponents(
  userId: string,
  limit: number
): Promise<ChampionPickCount[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(scoutTag(userId));

  const rows = await db
    .select({
      name: matches.matchupChampionName,
      games: sql<number>`count(*)`.as("games"),
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, userId),
        sql`${matches.matchupChampionName} is not null`
      )
    )
    .groupBy(matches.matchupChampionName)
    .orderBy(sql`count(*) desc`)
    .limit(limit);

  return rows.filter((r): r is ChampionPickCount => !!r.name);
}

export async function getMostFacedOpponents(
  limit = 10
): Promise<ChampionPickCount[]> {
  const user = await requireUser();
  return getCachedMostFacedOpponents(user.id, limit);
}
