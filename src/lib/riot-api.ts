// Riot Games API service layer
// Docs: https://developer.riotgames.com/docs/lol

const RIOT_API_KEY = process.env.RIOT_API_KEY!;

// Regional routing for account-v1 (EUW -> europe)
const REGIONAL_HOST = "https://europe.api.riotgames.com";
// Platform routing for EUW1
const PLATFORM_HOST = "https://euw1.api.riotgames.com";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RiotAccount {
  puuid: string;
  gameName: string;
  tagLine: string;
}

export interface RiotSummoner {
  id: string; // encrypted summoner ID
  accountId: string;
  puuid: string;
  profileIconId: number;
  revisionDate: number;
  summonerLevel: number;
}

export interface RiotLeagueEntry {
  leagueId: string;
  summonerId: string;
  queueType: string; // "RANKED_SOLO_5x5" | "RANKED_FLEX_SR"
  tier: string; // "GOLD", "PLATINUM", etc.
  rank: string; // "I", "II", "III", "IV"
  leaguePoints: number;
  wins: number;
  losses: number;
}

export interface RiotMatchParticipant {
  puuid: string;
  summonerName: string;
  riotIdGameName: string;
  riotIdTagline: string;
  championId: number;
  championName: string;
  teamId: number;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  visionScore: number;
  individualPosition: string; // "MIDDLE", "TOP", etc.
  teamPosition: string;
  perks: {
    statPerks: { defense: number; flex: number; offense: number };
    styles: Array<{
      description: string; // "primaryStyle" | "subStyle"
      style: number;
      selections: Array<{ perk: number; var1: number; var2: number; var3: number }>;
    }>;
  };
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  wardsPlaced: number;
  wardsKilled: number;
}

export interface RiotMatchInfo {
  gameCreation: number;
  gameDuration: number; // seconds
  gameId: number;
  gameMode: string;
  gameType: string;
  queueId: number;
  participants: RiotMatchParticipant[];
}

export interface RiotMatch {
  metadata: {
    matchId: string;
    participants: string[]; // puuids
  };
  info: RiotMatchInfo;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

class RiotApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "RiotApiError";
  }
}

async function riotFetch<T>(url: string, retries = 5): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "X-Riot-Token": RIOT_API_KEY,
      },
      cache: "no-store",
    });

    if (response.ok) {
      return response.json();
    }

    if (response.status === 403) {
      throw new RiotApiError(
        403,
        "Riot API key is invalid or expired. Regenerate it at developer.riotgames.com"
      );
    }

    if (response.status === 429) {
      if (attempt === retries) {
        throw new RiotApiError(429, "Rate limited by Riot API after multiple retries.");
      }
      // Use Retry-After header if available, otherwise exponential backoff
      const retryAfter = response.headers.get("Retry-After");
      const waitSeconds = retryAfter ? parseInt(retryAfter, 10) : Math.pow(2, attempt + 1);
      console.log(`Rate limited. Waiting ${waitSeconds}s before retry ${attempt + 1}/${retries}...`);
      await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
      continue;
    }

    const body = await response.text().catch(() => "");
    throw new RiotApiError(
      response.status,
      `Riot API error ${response.status}: ${body}`
    );
  }

  // Should never reach here, but TypeScript needs it
  throw new RiotApiError(500, "Unexpected error in riotFetch");
}

// ─── Account ─────────────────────────────────────────────────────────────────

export async function getAccountByRiotId(
  gameName: string,
  tagLine: string
): Promise<RiotAccount> {
  return riotFetch<RiotAccount>(
    `${REGIONAL_HOST}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  );
}

export async function getSummonerByPuuid(puuid: string): Promise<RiotSummoner> {
  return riotFetch<RiotSummoner>(
    `${PLATFORM_HOST}/lol/summoner/v4/summoners/by-puuid/${puuid}`
  );
}

// ─── League / Rank ───────────────────────────────────────────────────────────

export async function getLeagueEntries(
  summonerId: string
): Promise<RiotLeagueEntry[]> {
  return riotFetch<RiotLeagueEntry[]>(
    `${PLATFORM_HOST}/lol/league/v4/entries/by-summoner/${summonerId}`
  );
}

export async function getSoloQueueEntry(
  summonerId: string
): Promise<RiotLeagueEntry | null> {
  const entries = await getLeagueEntries(summonerId);
  return entries.find((e) => e.queueType === "RANKED_SOLO_5x5") || null;
}

// ─── Matches ─────────────────────────────────────────────────────────────────

export async function getMatchIds(
  puuid: string,
  options: {
    queue?: number; // 420 = Solo/Duo
    count?: number;
    start?: number;
    startTime?: number; // epoch seconds
  } = {}
): Promise<string[]> {
  const params = new URLSearchParams();
  if (options.queue !== undefined) params.set("queue", String(options.queue));
  if (options.count !== undefined) params.set("count", String(options.count));
  if (options.start !== undefined) params.set("start", String(options.start));
  if (options.startTime !== undefined)
    params.set("startTime", String(options.startTime));

  const queryString = params.toString();
  return riotFetch<string[]>(
    `${REGIONAL_HOST}/lol/match/v5/matches/by-puuid/${puuid}/ids${queryString ? `?${queryString}` : ""}`
  );
}

export async function getMatch(matchId: string): Promise<RiotMatch> {
  return riotFetch<RiotMatch>(
    `${REGIONAL_HOST}/lol/match/v5/matches/${matchId}`
  );
}

// ─── Data Extraction Helpers ─────────────────────────────────────────────────

/**
 * Extract the player's data from a match
 */
export function extractPlayerData(match: RiotMatch, puuid: string) {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) return null;

  const gameDuration = match.info.gameDuration;
  const cs =
    participant.totalMinionsKilled + participant.neutralMinionsKilled;
  const csPerMin = gameDuration > 0 ? cs / (gameDuration / 60) : 0;

  // Get keystone rune
  const primaryStyle = participant.perks?.styles?.find(
    (s) => s.description === "primaryStyle"
  );
  const keystoneId = primaryStyle?.selections?.[0]?.perk;

  return {
    matchId: match.metadata.matchId,
    gameDate: new Date(match.info.gameCreation),
    result: participant.win ? ("Victory" as const) : ("Defeat" as const),
    championId: participant.championId,
    championName: participant.championName,
    runeKeystoneId: keystoneId || null,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    cs,
    csPerMin: Math.round(csPerMin * 10) / 10,
    gameDurationSeconds: gameDuration,
    goldEarned: participant.goldEarned,
    visionScore: participant.visionScore,
    queueId: match.info.queueId,
    teamId: participant.teamId,
    position: participant.teamPosition || participant.individualPosition,
    items: [
      participant.item0,
      participant.item1,
      participant.item2,
      participant.item3,
      participant.item4,
      participant.item5,
      participant.item6,
    ],
    totalDamageDealtToChampions: participant.totalDamageDealtToChampions,
    totalDamageTaken: participant.totalDamageTaken,
  };
}

/**
 * Find the enemy laner (matchup) based on position
 */
export function findMatchupChampion(
  match: RiotMatch,
  puuid: string
): { championId: number; championName: string } | null {
  const player = match.info.participants.find((p) => p.puuid === puuid);
  if (!player) return null;

  const position = player.teamPosition || player.individualPosition;
  if (!position || position === "Invalid") {
    // Fallback: find enemy with same position label
    return null;
  }

  const enemy = match.info.participants.find(
    (p) =>
      p.teamId !== player.teamId &&
      (p.teamPosition === position || p.individualPosition === position)
  );

  if (!enemy) return null;

  return {
    championId: enemy.championId,
    championName: enemy.championName,
  };
}

// ─── Data Dragon ─────────────────────────────────────────────────────────────

let cachedVersion: string | null = null;

export async function getLatestVersion(): Promise<string> {
  if (cachedVersion) return cachedVersion;

  const versions = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json"
  ).then((r) => r.json());

  cachedVersion = versions[0];
  return cachedVersion!;
}

export function getChampionIconUrl(version: string, championName: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${championName}.png`;
}

export function getItemIconUrl(version: string, itemId: number) {
  if (itemId === 0) return null;
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`;
}

// Rune keystone name mapping (common ones)
const KEYSTONE_NAMES: Record<number, string> = {
  // Precision
  8005: "Press the Attack",
  8008: "Lethal Tempo",
  8021: "Fleet Footwork",
  8010: "Conqueror",
  // Domination
  8112: "Electrocute",
  8124: "Predator",
  8128: "Dark Harvest",
  9923: "Hail of Blades",
  // Sorcery
  8214: "Summon Aery",
  8229: "Arcane Comet",
  8230: "Phase Rush",
  // Resolve
  8437: "Grasp of the Undying",
  8439: "Aftershock",
  8465: "Guardian",
  // Inspiration
  8351: "Glacial Augment",
  8360: "Unsealed Spellbook",
  8369: "First Strike",
};

export function getKeystoneName(keystoneId: number): string {
  return KEYSTONE_NAMES[keystoneId] || `Rune ${keystoneId}`;
}
