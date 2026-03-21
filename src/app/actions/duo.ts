"use server";

import { db } from "@/db";
import { matches, users } from "@/db/schema";
import { eq, and, isNotNull, desc, sql, count } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import type { RiotMatch, RiotMatchParticipant } from "@/lib/riot-api";

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
  // Partner stats from rawMatchJson
  partnerAvgKills: number;
  partnerAvgDeaths: number;
  partnerAvgAssists: number;
  // Solo comparison
  soloGames: number;
  soloWins: number;
  soloWinRate: number;
}

export interface DuoGameRow {
  id: string;
  gameDate: Date;
  result: "Victory" | "Defeat";
  championName: string;
  kills: number;
  deaths: number;
  assists: number;
  gameDurationSeconds: number;
  // Partner info extracted from rawMatchJson
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

// ─── Helper: Extract partner participant from rawMatchJson ───────────────────

function extractPartnerData(
  rawJson: string,
  partnerPuuid: string
): RiotMatchParticipant | null {
  try {
    const matchData: RiotMatch = JSON.parse(rawJson);
    return (
      matchData.info.participants.find((p) => p.puuid === partnerPuuid) || null
    );
  } catch {
    return null;
  }
}

// ─── Duo Partner Info ────────────────────────────────────────────────────────

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

// ─── Duo Stats ───────────────────────────────────────────────────────────────

export async function getDuoStats(): Promise<DuoStats | null> {
  const user = await requireUser();
  if (!user.duoPartnerUserId) return null;

  const partner = await db.query.users.findFirst({
    where: eq(users.id, user.duoPartnerUserId),
    columns: { puuid: true },
  });
  if (!partner?.puuid) return null;

  const partnerPuuid = partner.puuid;

  // Aggregate duo games
  const duoAgg = await db
    .select({
      totalGames: count(),
      wins: sql<number>`SUM(CASE WHEN ${matches.result} = 'Victory' THEN 1 ELSE 0 END)`,
      avgKills: sql<number>`AVG(${matches.kills})`,
      avgDeaths: sql<number>`AVG(${matches.deaths})`,
      avgAssists: sql<number>`AVG(${matches.assists})`,
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, user.id),
        isNotNull(matches.duoPartnerPuuid)
      )
    );

  const duo = duoAgg[0];
  if (!duo || duo.totalGames === 0) {
    // Return empty stats
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

  // Solo stats (games without duo partner)
  const soloAgg = await db
    .select({
      totalGames: count(),
      wins: sql<number>`SUM(CASE WHEN ${matches.result} = 'Victory' THEN 1 ELSE 0 END)`,
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, user.id),
        sql`${matches.duoPartnerPuuid} IS NULL`
      )
    );

  const solo = soloAgg[0];

  // Get partner KDA from rawMatchJson (need to iterate duo matches)
  const duoMatches = await db
    .select({
      rawMatchJson: matches.rawMatchJson,
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, user.id),
        isNotNull(matches.duoPartnerPuuid)
      )
    );

  let partnerKillsSum = 0;
  let partnerDeathsSum = 0;
  let partnerAssistsSum = 0;
  let partnerDataCount = 0;

  for (const m of duoMatches) {
    if (!m.rawMatchJson) continue;
    const partnerData = extractPartnerData(m.rawMatchJson, partnerPuuid);
    if (partnerData) {
      partnerKillsSum += partnerData.kills;
      partnerDeathsSum += partnerData.deaths;
      partnerAssistsSum += partnerData.assists;
      partnerDataCount++;
    }
  }

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
    partnerAvgKills:
      partnerDataCount > 0
        ? Math.round((partnerKillsSum / partnerDataCount) * 10) / 10
        : 0,
    partnerAvgDeaths:
      partnerDataCount > 0
        ? Math.round((partnerDeathsSum / partnerDataCount) * 10) / 10
        : 0,
    partnerAvgAssists:
      partnerDataCount > 0
        ? Math.round((partnerAssistsSum / partnerDataCount) * 10) / 10
        : 0,
    soloGames: solo?.totalGames ?? 0,
    soloWins: solo?.wins ?? 0,
    soloWinRate:
      solo && solo.totalGames > 0
        ? Math.round(((solo.wins ?? 0) / solo.totalGames) * 100)
        : 0,
  };
}

// ─── Duo Games (paginated) ───────────────────────────────────────────────────

export async function getDuoGames(page: number = 1): Promise<{
  games: DuoGameRow[];
  totalPages: number;
}> {
  const user = await requireUser();
  if (!user.duoPartnerUserId) return { games: [], totalPages: 0 };

  const partner = await db.query.users.findFirst({
    where: eq(users.id, user.duoPartnerUserId),
    columns: { puuid: true },
  });
  if (!partner?.puuid) return { games: [], totalPages: 0 };

  const partnerPuuid = partner.puuid;

  // Count total duo games
  const countResult = await db
    .select({ total: count() })
    .from(matches)
    .where(
      and(
        eq(matches.userId, user.id),
        isNotNull(matches.duoPartnerPuuid)
      )
    );

  const total = countResult[0]?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // Fetch page
  const offset = (page - 1) * PAGE_SIZE;
  const rows = await db
    .select({
      id: matches.id,
      gameDate: matches.gameDate,
      result: matches.result,
      championName: matches.championName,
      kills: matches.kills,
      deaths: matches.deaths,
      assists: matches.assists,
      gameDurationSeconds: matches.gameDurationSeconds,
      rawMatchJson: matches.rawMatchJson,
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, user.id),
        isNotNull(matches.duoPartnerPuuid)
      )
    )
    .orderBy(desc(matches.gameDate))
    .limit(PAGE_SIZE)
    .offset(offset);

  const games: DuoGameRow[] = rows.map((row) => {
    let partnerChampionName = "Unknown";
    let partnerKills = 0;
    let partnerDeaths = 0;
    let partnerAssists = 0;

    if (row.rawMatchJson) {
      const partnerData = extractPartnerData(row.rawMatchJson, partnerPuuid);
      if (partnerData) {
        partnerChampionName = partnerData.championName;
        partnerKills = partnerData.kills;
        partnerDeaths = partnerData.deaths;
        partnerAssists = partnerData.assists;
      }
    }

    return {
      id: row.id,
      gameDate: row.gameDate,
      result: row.result,
      championName: row.championName,
      kills: row.kills,
      deaths: row.deaths,
      assists: row.assists,
      gameDurationSeconds: row.gameDurationSeconds,
      partnerChampionName,
      partnerKills,
      partnerDeaths,
      partnerAssists,
    };
  });

  return { games, totalPages };
}

// ─── Champion Synergy ────────────────────────────────────────────────────────

export async function getChampionSynergy(): Promise<ChampionSynergy[]> {
  const user = await requireUser();
  if (!user.duoPartnerUserId) return [];

  const partner = await db.query.users.findFirst({
    where: eq(users.id, user.duoPartnerUserId),
    columns: { puuid: true },
  });
  if (!partner?.puuid) return [];

  const partnerPuuid = partner.puuid;

  // Get all duo matches with rawMatchJson
  const duoMatches = await db
    .select({
      championName: matches.championName,
      result: matches.result,
      rawMatchJson: matches.rawMatchJson,
    })
    .from(matches)
    .where(
      and(
        eq(matches.userId, user.id),
        isNotNull(matches.duoPartnerPuuid)
      )
    );

  // Build synergy map: "YourChamp|PartnerChamp" -> { games, wins }
  const synergyMap = new Map<string, { games: number; wins: number }>();

  for (const m of duoMatches) {
    if (!m.rawMatchJson) continue;
    const partnerData = extractPartnerData(m.rawMatchJson, partnerPuuid);
    if (!partnerData) continue;

    const key = `${m.championName}|${partnerData.championName}`;
    const entry = synergyMap.get(key) || { games: 0, wins: 0 };
    entry.games++;
    if (m.result === "Victory") entry.wins++;
    synergyMap.set(key, entry);
  }

  // Convert to array and sort by games desc
  const synergies: ChampionSynergy[] = [];
  for (const [key, val] of synergyMap) {
    const [yourChampion, partnerChampion] = key.split("|");
    synergies.push({
      yourChampion,
      partnerChampion,
      games: val.games,
      wins: val.wins,
      winRate: val.games > 0 ? Math.round((val.wins / val.games) * 100) : 0,
    });
  }

  synergies.sort((a, b) => b.games - a.games);

  return synergies;
}
