// Riot Games API service layer
// Docs: https://developer.riotgames.com/docs/lol

function getRiotApiKey(): string {
  return process.env.RIOT_API_KEY!;
}

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

export class RiotApiError extends Error {
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
        "X-Riot-Token": getRiotApiKey(),
      },
      cache: "no-store",
    });

    if (response.ok) {
      return response.json();
    }

    if (response.status === 401 || response.status === 403) {
      throw new RiotApiError(
        response.status,
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

// ─── Spectator / Active Game Types ───────────────────────────────────────────

export interface CurrentGamePerks {
  perkIds: number[];
  perkStyle: number;
  perkSubStyle: number;
}

export interface CurrentGameParticipant {
  championId: number;
  perks: CurrentGamePerks;
  profileIconId: number;
  bot: boolean;
  teamId: number; // 100 = blue, 200 = red
  puuid: string | null; // null when player is anonymous
  spell1Id: number;
  spell2Id: number;
  riotId: string | null; // gameName#tagLine
  gameCustomizationObjects: Array<{ category: string; content: string }>;
}

export interface BannedChampion {
  pickTurn: number;
  championId: number;
  teamId: number;
}

export interface CurrentGameInfo {
  gameId: number;
  gameType: string;
  gameStartTime: number; // epoch millis
  mapId: number;
  gameLength: number; // seconds elapsed
  platformId: string;
  gameMode: string;
  gameQueueConfigId: number | null;
  bannedChampions: BannedChampion[];
  observers: { encryptionKey: string };
  participants: CurrentGameParticipant[];
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

// ─── Spectator / Active Game ────────────────────────────────────────────────

/**
 * Check if a player is currently in a game.
 * Returns null if the player is not in an active game (404).
 */
export async function getActiveGame(
  puuid: string
): Promise<CurrentGameInfo | null> {
  const url = `${PLATFORM_HOST}/lol/spectator/v5/active-games/by-summoner/${puuid}`;
  try {
    const response = await fetch(url, {
      headers: { "X-Riot-Token": getRiotApiKey() },
      cache: "no-store",
    });

    if (response.status === 404) {
      return null; // Not in game — this is expected
    }

    if (response.status === 401 || response.status === 403) {
      throw new RiotApiError(
        response.status,
        "Riot API key is invalid or expired. Regenerate it at developer.riotgames.com"
      );
    }

    if (response.status === 429) {
      throw new RiotApiError(429, "Rate limited by Riot API. Try again in a moment.");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new RiotApiError(
        response.status,
        `Spectator API error ${response.status}: ${body}`
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof RiotApiError) throw error;
    throw new RiotApiError(500, `Failed to check active game: ${error}`);
  }
}

// ─── Champion ID Mapping (Data Dragon) ──────────────────────────────────────

let cachedChampionMap: Map<number, string> | null = null;

/**
 * Fetch a mapping of champion ID -> champion name (Data Dragon key) from DDragon.
 * Cached in-memory after first call, with a 24h revalidation on the fetch.
 */
export async function getChampionIdMap(
  version?: string
): Promise<Map<number, string>> {
  if (cachedChampionMap) return cachedChampionMap;

  const ver = version || (await getLatestVersion());
  const url = `https://ddragon.leagueoflegends.com/cdn/${ver}/data/en_US/champion.json`;
  const data = await fetch(url, { next: { revalidate: 86400 } }).then((r) => r.json());

  const map = new Map<number, string>();
  for (const champ of Object.values(data.data) as Array<{
    key: string;
    id: string;
  }>) {
    map.set(parseInt(champ.key, 10), champ.id);
  }

  cachedChampionMap = map;
  return map;
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

/**
 * Check if a duo partner was on the same team in a match.
 * Returns the partner's puuid if found on same team, null otherwise.
 */
export function findDuoPartner(
  match: RiotMatch,
  playerPuuid: string,
  duoPartnerPuuid: string
): string | null {
  const player = match.info.participants.find((p) => p.puuid === playerPuuid);
  if (!player) return null;

  const partner = match.info.participants.find(
    (p) => p.puuid === duoPartnerPuuid && p.teamId === player.teamId
  );

  return partner ? partner.puuid : null;
}

// ─── Data Dragon ─────────────────────────────────────────────────────────────

export async function getLatestVersion(): Promise<string> {
  // Revalidate once per day — DDragon versions change infrequently
  const versions = await fetch(
    "https://ddragon.leagueoflegends.com/api/versions.json",
    { next: { revalidate: 86400 } }
  ).then((r) => r.json());

  return versions[0];
}

/**
 * Normalize champion name from Riot Match API to DDragon `id` for image URLs.
 * The Riot Match API occasionally returns names that differ from DDragon's `id` field.
 */
const CHAMPION_NAME_FIXES: Record<string, string> = {
  FiddleSticks: "Fiddlesticks", // Riot API uses capital S, DDragon uses lowercase
};

export function normalizeDDragonChampionName(championName: string): string {
  return CHAMPION_NAME_FIXES[championName] || championName;
}

export function getChampionIconUrl(version: string, championName: string) {
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${normalizeDDragonChampionName(championName)}.png`;
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

// Rune keystone icon path mapping (DDragon perk-images)
// NOTE: Rune icons are NOT versioned — use /cdn/img/ not /cdn/{version}/img/
const KEYSTONE_ICONS: Record<number, string> = {
  // Precision
  8005: "perk-images/Styles/Precision/PressTheAttack/PressTheAttack.png",
  8008: "perk-images/Styles/Precision/LethalTempo/LethalTempoTemp.png", // Removed from game, legacy icon
  8021: "perk-images/Styles/Precision/FleetFootwork/FleetFootwork.png",
  8010: "perk-images/Styles/Precision/Conqueror/Conqueror.png",
  // Domination
  8112: "perk-images/Styles/Domination/Electrocute/Electrocute.png",
  8124: "perk-images/Styles/Domination/Predator/Predator.png", // Removed from game, legacy icon
  8128: "perk-images/Styles/Domination/DarkHarvest/DarkHarvest.png",
  9923: "perk-images/Styles/Domination/HailOfBlades/HailOfBlades.png",
  // Sorcery
  8214: "perk-images/Styles/Sorcery/SummonAery/SummonAery.png",
  8229: "perk-images/Styles/Sorcery/ArcaneComet/ArcaneComet.png",
  8230: "perk-images/Styles/Sorcery/PhaseRush/PhaseRush.png",
  // Resolve
  8437: "perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png",
  8439: "perk-images/Styles/Resolve/VeteranAftershock/VeteranAftershock.png",
  8465: "perk-images/Styles/Resolve/Guardian/Guardian.png",
  // Inspiration
  8351: "perk-images/Styles/Inspiration/GlacialAugment/GlacialAugment.png",
  8360: "perk-images/Styles/Inspiration/UnsealedSpellbook/UnsealedSpellbook.png",
  8369: "perk-images/Styles/Inspiration/FirstStrike/FirstStrike.png",
};

/**
 * Get the DDragon icon URL for a keystone rune.
 * Returns null if the keystone ID is unknown.
 */
export function getKeystoneIconUrl(keystoneId: number): string | null {
  const path = KEYSTONE_ICONS[keystoneId];
  if (!path) return null;
  return `https://ddragon.leagueoflegends.com/cdn/img/${path}`;
}

/**
 * Get the DDragon icon URL for a keystone by name.
 * Reverse-looks up the name in KEYSTONE_NAMES to find the ID, then gets the icon.
 */
export function getKeystoneIconUrlByName(keystoneName: string): string | null {
  for (const [idStr, name] of Object.entries(KEYSTONE_NAMES)) {
    if (name === keystoneName) {
      return getKeystoneIconUrl(Number(idStr));
    }
  }
  return null;
}
