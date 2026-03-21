"use server";

import { db } from "@/db";
import { matches } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import {
  getActiveGame,
  getChampionIdMap,
  getKeystoneName,
  type RiotMatch,
} from "@/lib/riot-api";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EnemyChampion {
  championId: number;
  championName: string;
}

export interface LiveMatchupResult {
  inGame: boolean;
  userChampionId: number | null;
  userChampionName: string | null;
  opponentChampionId: number | null;
  opponentChampionName: string | null;
  enemyTeam: EnemyChampion[];
  gameQueueId: number | null;
  error?: string;
}

export interface MatchupGameDetail {
  matchId: string;
  gameDate: Date;
  result: "Victory" | "Defeat";
  championName: string;
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
}

export interface RuneBreakdown {
  keystoneName: string;
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
  games: MatchupGameDetail[];
}

export interface RecentUnreviewedMatch {
  matchId: string;
  gameDate: Date;
  result: "Victory" | "Defeat";
  championName: string;
  matchupChampionName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  runeKeystoneName: string | null;
  items: number[];
  gameDurationSeconds: number;
}

// ─── detectLiveMatchup ──────────────────────────────────────────────────────

/**
 * Check if the user is currently in a live game.
 * If so, identify their champion and their lane opponent.
 */
export async function detectLiveMatchup(): Promise<LiveMatchupResult> {
  const user = await requireUser();

  if (!user.puuid) {
    return {
      inGame: false,
      userChampionId: null,
      userChampionName: null,
      opponentChampionId: null,
      opponentChampionName: null,
      enemyTeam: [],
      gameQueueId: null,
      error: "No Riot account linked. Go to Settings to link your account.",
    };
  }

  try {
    const game = await getActiveGame(user.puuid);

    if (!game) {
      return {
        inGame: false,
        userChampionId: null,
        userChampionName: null,
        opponentChampionId: null,
        opponentChampionName: null,
        enemyTeam: [],
        gameQueueId: null,
      };
    }

    const championMap = await getChampionIdMap();

    // Find the user in the game
    const userParticipant = game.participants.find(
      (p) => p.puuid === user.puuid
    );

    if (!userParticipant) {
      return {
        inGame: true,
        userChampionId: null,
        userChampionName: null,
        opponentChampionId: null,
        opponentChampionName: null,
        enemyTeam: [],
        gameQueueId: game.gameQueueConfigId,
        error: "Could not find you in the active game participants.",
      };
    }

    const userChampionName =
      championMap.get(userParticipant.championId) || "Unknown";

    // Extract enemy team champions
    const enemyTeam: EnemyChampion[] = game.participants
      .filter((p) => p.teamId !== userParticipant.teamId)
      .map((p) => ({
        championId: p.championId,
        championName: championMap.get(p.championId) || "Unknown",
      }));

    return {
      inGame: true,
      userChampionId: userParticipant.championId,
      userChampionName: userChampionName,
      opponentChampionId: null,
      opponentChampionName: null,
      enemyTeam,
      gameQueueId: game.gameQueueConfigId,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to check live game";
    return {
      inGame: false,
      userChampionId: null,
      userChampionName: null,
      opponentChampionId: null,
      opponentChampionName: null,
      enemyTeam: [],
      gameQueueId: null,
      error: message,
    };
  }
}

// ─── getMatchupReport ───────────────────────────────────────────────────────

/**
 * Build a full scouting report for a specific matchup champion.
 * Optionally filter by your own champion for champion-vs-champion stats.
 * Queries all of the user's matches against that champion and aggregates stats.
 */
export async function getMatchupReport(
  matchupChampionName: string,
  yourChampionName?: string
): Promise<MatchupReport | null> {
  const user = await requireUser();

  // Build where conditions
  const conditions = [
    eq(matches.userId, user.id),
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
  const games: MatchupGameDetail[] = matchRows.map((m) => {
    let items: number[] = [0, 0, 0, 0, 0, 0, 0];

    if (m.rawMatchJson) {
      try {
        const raw: RiotMatch = JSON.parse(m.rawMatchJson);
        const participant = raw.info.participants.find(
          (p) => p.puuid === user.puuid
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
    };
  });

  return {
    matchupChampionName,
    record,
    lastPlayed,
    runeBreakdown,
    avgStats,
    games,
  };
}

// ─── getRecentUnreviewedMatch ───────────────────────────────────────────────

/**
 * Get the user's latest match if it was played within the last ~2 hours
 * and has no comment/notes yet. Used for the post-game review prompt.
 */
export async function getRecentUnreviewedMatch(): Promise<RecentUnreviewedMatch | null> {
  const user = await requireUser();

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  // Get most recent match
  const [latestMatch] = await db
    .select()
    .from(matches)
    .where(eq(matches.userId, user.id))
    .orderBy(desc(matches.gameDate))
    .limit(1);

  if (!latestMatch) return null;

  // Check if it's within 2 hours and has no comment/review
  if (latestMatch.gameDate < twoHoursAgo) return null;
  if (latestMatch.comment || latestMatch.reviewed) return null;

  // Extract items from rawMatchJson
  let items: number[] = [0, 0, 0, 0, 0, 0, 0];
  if (latestMatch.rawMatchJson) {
    try {
      const raw: RiotMatch = JSON.parse(latestMatch.rawMatchJson);
      const participant = raw.info.participants.find(
        (p) => p.puuid === user.puuid
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
      // Ignore parse errors
    }
  }

  return {
    matchId: latestMatch.id,
    gameDate: latestMatch.gameDate,
    result: latestMatch.result as "Victory" | "Defeat",
    championName: latestMatch.championName,
    matchupChampionName: latestMatch.matchupChampionName,
    kills: latestMatch.kills,
    deaths: latestMatch.deaths,
    assists: latestMatch.assists,
    runeKeystoneName: latestMatch.runeKeystoneName,
    items,
    gameDurationSeconds: latestMatch.gameDurationSeconds,
  };
}

// ─── getUniqueMatchupChampions ──────────────────────────────────────────────

/**
 * Get a sorted list of all unique opponent champion names the user has faced.
 * Used to populate the matchup picker dropdown.
 */
export async function getUniqueMatchupChampions(): Promise<string[]> {
  const user = await requireUser();

  const rows = await db
    .selectDistinct({ matchupChampionName: matches.matchupChampionName })
    .from(matches)
    .where(eq(matches.userId, user.id));

  return rows
    .map((r) => r.matchupChampionName)
    .filter((name): name is string => !!name)
    .sort();
}

// ─── getAllChampionNames ────────────────────────────────────────────────────

/**
 * Get a sorted list of ALL champion names from DDragon.
 * Used to populate searchable champion comboboxes.
 */
export async function getAllChampionNames(): Promise<string[]> {
  const championMap = await getChampionIdMap();
  return Array.from(championMap.values()).sort();
}
