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

// ─── Demo user constants (must match seed.ts) ───────────────────────────────

const DEMO_MAIN = {
  puuid: "demo-puuid-main-0000000000000000000000000000000000000000",
  gameName: "DemoPlayer",
  tagLine: "EUW",
};

const DEMO_DUO = {
  puuid: "demo-puuid-duo-00000000000000000000000000000000000000000",
  gameName: "DuoPartner",
  tagLine: "EUW",
};

// ─── Mock: getAccountByRiotId ────────────────────────────────────────────────

export async function mockGetAccountByRiotId(
  gameName: string,
  tagLine: string,
): Promise<{ puuid: string; gameName: string; tagLine: string }> {
  // Match against seeded accounts
  const lower = gameName.toLowerCase();

  if (lower === "demoplayer" && tagLine.toUpperCase() === "EUW") {
    return DEMO_MAIN;
  }
  if (lower === "duopartner" && tagLine.toUpperCase() === "EUW") {
    return DEMO_DUO;
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
  if (puuid === DEMO_MAIN.puuid) {
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

export async function mockGetMatchIds(): Promise<string[]> {
  // All matches are already seeded — return empty to simulate "no new matches"
  return [];
}

// ─── Mock: getMatch ──────────────────────────────────────────────────────────

export async function mockGetMatch(matchId: string): Promise<RiotMatch> {
  // This should rarely be called in demo mode since getMatchIds returns [],
  // but provide a minimal valid response in case it is.
  return {
    metadata: {
      matchId,
      participants: [DEMO_MAIN.puuid],
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
        {
          puuid: DEMO_MAIN.puuid,
          summonerName: DEMO_MAIN.gameName,
          riotIdGameName: DEMO_MAIN.gameName,
          riotIdTagline: DEMO_MAIN.tagLine,
          championId: 103,
          championName: "Ahri",
          teamId: 100,
          win: true,
          kills: 5,
          deaths: 2,
          assists: 8,
          totalMinionsKilled: 180,
          neutralMinionsKilled: 10,
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
                selections: [
                  { perk: 8112, var1: 0, var2: 0, var3: 0 },
                ],
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
      ],
    },
  };
}
