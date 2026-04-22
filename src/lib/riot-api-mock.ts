/**
 * Riot API mock layer for demo/preview mode.
 *
 * When NEXT_PUBLIC_DEMO_MODE=true, these functions replace the real Riot API
 * calls with canned responses consistent with the seed data.
 *
 * DDragon calls (icons, versions, champion data) are NOT mocked — they're
 * public endpoints that don't require an API key.
 */

import type { RiotMatch } from "@/lib/riot-api";

// ─── Seed user constants (must match seed.ts) ───────────────────────────────

const SEED_MAIN = {
  puuid: "seed-puuid-main-0000000000000000000000000000000000000000",
  gameName: "SeedPlayer",
  tagLine: "EUW",
};

const SEED_DUO = {
  puuid: "seed-puuid-duo-00000000000000000000000000000000000000000",
  gameName: "DuoPartner",
  tagLine: "EUW",
};

// ─── Mock: getAccountByRiotId ────────────────────────────────────────────────

export async function mockGetAccountByRiotId(
  gameName: string,
  tagLine: string,
  _region?: string,
): Promise<{ puuid: string; gameName: string; tagLine: string }> {
  // Match against seeded accounts
  const lower = gameName.toLowerCase();

  if (lower === "seedplayer" && tagLine.toUpperCase() === "EUW") {
    return SEED_MAIN;
  }
  if (lower === "duopartner" && tagLine.toUpperCase() === "EUW") {
    return SEED_DUO;
  }

  // For any other Riot ID in demo mode, return a fake account
  // so the "link Riot account" flow works for testing
  return {
    puuid: `demo-puuid-${lower}-${tagLine.toLowerCase()}`.padEnd(60, "0"),
    gameName,
    tagLine,
  };
}

// ─── Mock: getSoloQueueEntryByPuuid ──────────────────────────────────────────

export async function mockGetSoloQueueEntryByPuuid(
  puuid: string,
  _region?: string,
): Promise<{
  leagueId: string;
  summonerId: string;
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
} | null> {
  if (puuid === SEED_MAIN.puuid) {
    return {
      leagueId: "demo-league-001",
      summonerId: "demo-summoner-main",
      queueType: "RANKED_SOLO_5x5",
      tier: "GOLD",
      rank: "III",
      leaguePoints: 62,
      wins: 55,
      losses: 39,
    };
  }

  // Unknown puuid — no rank data
  return null;
}

// ─── Mock: getMatchIds ───────────────────────────────────────────────────────

export async function mockGetMatchIds(_region?: string): Promise<string[]> {
  // Return one new match so demo-mode sync triggers challenge evaluation.
  // This match ID must NOT exist in seed data — it simulates a "new" game.
  return ["EUW1_DEMO_CHALLENGE_001"];
}

// ─── Mock: getMatch ──────────────────────────────────────────────────────────

// Helper to generate a filler participant for the mock match
function filler(
  index: number,
  teamId: number,
  position: string,
  champion: { id: number; name: string },
  win: boolean,
): RiotMatch["info"]["participants"][number] {
  return {
    puuid: `mock-puuid-filler-${index}`.padEnd(60, "0"),
    summonerName: `Player${index}`,
    riotIdGameName: `Player${index}`,
    riotIdTagline: "EUW",
    championId: champion.id,
    championName: champion.name,
    teamId,
    win,
    kills: 3 + (index % 5),
    deaths: 2 + (index % 4),
    assists: 5 + (index % 6),
    totalMinionsKilled: 120 + index * 10,
    neutralMinionsKilled: position === "JUNGLE" ? 80 : 5,
    goldEarned: 9000 + index * 300,
    visionScore: 15 + index,
    individualPosition: position,
    teamPosition: position,
    perks: {
      statPerks: { defense: 5002, flex: 5008, offense: 5005 },
      styles: [
        {
          description: "primaryStyle",
          style: 8000,
          selections: [{ perk: 8005, var1: 0, var2: 0, var3: 0 }],
        },
      ],
    },
    item0: 3006,
    item1: 3031,
    item2: 3036,
    item3: 3072,
    item4: 3046,
    item5: 3026,
    item6: 3340,
    totalDamageDealtToChampions: 15000 + index * 500,
    totalDamageTaken: 12000 + index * 400,
    wardsPlaced: 8 + index,
    wardsKilled: 2 + (index % 3),
  };
}

export async function mockGetMatch(matchId: string, _region?: string): Promise<RiotMatch> {
  // Mock match with stats that trigger one challenge success and one failure:
  // - CS/min ~8.0 (totalMinionsKilled=210 + neutralMinionsKilled=30 in 30min) → passes cspm ≥ 7
  // - Deaths: 7 → fails deaths ≤ 5
  //
  // Full 10-player match so extractPlayerData and findMatchupChampion work correctly.
  return {
    metadata: {
      matchId,
      participants: [
        SEED_MAIN.puuid,
        ...Array.from({ length: 9 }, (_, i) => `mock-puuid-filler-${i + 1}`.padEnd(60, "0")),
      ],
    },
    info: {
      gameCreation: Date.now(),
      gameDuration: 1800,
      gameEndedInEarlySurrender: false,
      gameId: parseInt(matchId.replace("EUW1_", ""), 10) || 0,
      gameMode: "CLASSIC",
      gameType: "MATCHED_GAME",
      queueId: 420,
      participants: [
        // ── Team 100 (blue side, wins) ──
        {
          puuid: SEED_MAIN.puuid,
          summonerName: SEED_MAIN.gameName,
          riotIdGameName: SEED_MAIN.gameName,
          riotIdTagline: SEED_MAIN.tagLine,
          championId: 103,
          championName: "Ahri",
          teamId: 100,
          win: true,
          kills: 5,
          deaths: 7,
          assists: 8,
          totalMinionsKilled: 210,
          neutralMinionsKilled: 30,
          goldEarned: 12000,
          visionScore: 25,
          individualPosition: "MIDDLE",
          teamPosition: "MIDDLE",
          perks: {
            statPerks: { defense: 5002, flex: 5008, offense: 5005 },
            styles: [
              {
                description: "primaryStyle",
                style: 8100,
                selections: [{ perk: 8112, var1: 0, var2: 0, var3: 0 }],
              },
            ],
          },
          item0: 3157,
          item1: 3089,
          item2: 3020,
          item3: 3165,
          item4: 3135,
          item5: 3116,
          item6: 3340,
          totalDamageDealtToChampions: 22000,
          totalDamageTaken: 14000,
          wardsPlaced: 12,
          wardsKilled: 3,
        },
        filler(1, 100, "TOP", { id: 86, name: "Garen" }, true),
        filler(2, 100, "JUNGLE", { id: 64, name: "LeeSin" }, true),
        filler(3, 100, "BOTTOM", { id: 51, name: "Caitlyn" }, true),
        filler(4, 100, "UTILITY", { id: 12, name: "Alistar" }, true),
        // ── Team 200 (red side, loses) ──
        filler(5, 200, "TOP", { id: 122, name: "Darius" }, false),
        filler(6, 200, "JUNGLE", { id: 11, name: "MasterYi" }, false),
        filler(7, 200, "MIDDLE", { id: 238, name: "Zed" }, false), // enemy mid = matchup
        filler(8, 200, "BOTTOM", { id: 222, name: "Jinx" }, false),
        filler(9, 200, "UTILITY", { id: 53, name: "Blitzcrank" }, false),
      ],
    },
  };
}
