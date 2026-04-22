// scripts/seed.ts
// Deterministic seed data for dev/preview environments.
// Run: npm run db:seed
//
// IMPORTANT: Run migrations first (`npx tsx scripts/migrate.ts`) to
// create all tables. This script only inserts data — it does NOT
// create tables.
//
// Creates 3 users, ~75 matches (50 main + ~25 duo), rank snapshots,
// coaching sessions, action items, highlights, and invites. Uses a
// simple seeded PRNG for reproducibility (same seed = same data every time).

import { createClient } from "@libsql/client";

// ─── Seeded PRNG (mulberry32) ────────────────────────────────────────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);

function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

function _uuid(): string {
  // Simple v4-like UUID from PRNG
  const hex = "0123456789abcdef";
  let s = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      s += "-";
    } else if (i === 14) {
      s += "4";
    } else if (i === 19) {
      s += hex[(randInt(0, 15) & 0x3) | 0x8];
    } else {
      s += hex[randInt(0, 15)];
    }
  }
  return s;
}

// ─── Constants ───────────────────────────────────────────────────────────────

// Common item IDs from League of Legends
const ITEM_IDS = [
  3089, 3157, 3165, 3100, 3020, 3135, 3116, 3152, 3040, 3003, 3285, 3907, 3102, 3190, 3050, 3504,
  3115, 3091, 3153, 3124, 3046, 3094, 3031, 3036, 3072, 3139, 3156, 3026, 3742, 3143, 3065, 3083,
  3075, 3110, 3001, 2055, 3364, 3340,
];

const FAKE_NAMES = [
  "AzirLord99",
  "MidOrFeed",
  "JungleDiff",
  "TopGapper",
  "ADCarry420",
  "SupportMain",
  "FlashOnD",
  "GankMePlz",
  "BaronThief",
];

const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

const CHAMPIONS = [
  { id: 1, name: "Annie" },
  { id: 84, name: "Akali" },
  { id: 103, name: "Ahri" },
  { id: 112, name: "Viktor" },
  { id: 134, name: "Syndra" },
  { id: 7, name: "Leblanc" },
  { id: 238, name: "Zed" },
  { id: 4, name: "TwistedFate" },
  { id: 61, name: "Orianna" },
  { id: 69, name: "Cassiopeia" },
  { id: 245, name: "Ekko" },
  { id: 55, name: "Katarina" },
  { id: 8, name: "Vladimir" },
  { id: 90, name: "Malzahar" },
  { id: 99, name: "Lux" },
  { id: 45, name: "Veigar" },
  { id: 115, name: "Ziggs" },
  { id: 101, name: "Xerath" },
  { id: 161, name: "Velkoz" },
  { id: 127, name: "Lissandra" },
] as const;

// Main user's champion pool (weighted — plays these more often)
const MAIN_POOL = [
  { id: 103, name: "Ahri" },
  { id: 112, name: "Viktor" },
  { id: 134, name: "Syndra" },
  { id: 61, name: "Orianna" },
  { id: 245, name: "Ekko" },
] as const;

const KEYSTONES = [
  { id: 8010, name: "Conqueror" },
  { id: 8214, name: "Summon Aery" },
  { id: 8229, name: "Arcane Comet" },
  { id: 8112, name: "Electrocute" },
  { id: 8128, name: "Dark Harvest" },
  { id: 8021, name: "Fleet Footwork" },
  { id: 8230, name: "Phase Rush" },
  { id: 8369, name: "First Strike" },
] as const;

function pickUnique(usedIds: Set<number>): { id: number; name: string } {
  let champ = pick(CHAMPIONS);
  let attempts = 0;
  while (usedIds.has(champ.id) && attempts < 50) {
    champ = pick(CHAMPIONS);
    attempts++;
  }
  usedIds.add(champ.id);
  return champ;
}

function makeFakeParticipant(
  champ: { id: number; name: string },
  teamId: number,
  win: boolean,
  position: string,
  name: string,
  m: { durationSeconds: number },
): Record<string, unknown> {
  const durationMin = m.durationSeconds / 60;
  return {
    puuid: `fake-puuid-${name.toLowerCase()}-${champ.id}`,
    summonerName: name,
    riotIdGameName: name,
    riotIdTagline: "EUW",
    championId: champ.id,
    championName: champ.name,
    teamId,
    win,
    kills: randInt(0, 12),
    deaths: randInt(0, 8),
    assists: randInt(1, 15),
    totalMinionsKilled: Math.round(durationMin * (4 + rand() * 5)),
    neutralMinionsKilled: position === "JUNGLE" ? Math.round(durationMin * 3) : randInt(0, 20),
    goldEarned: randInt(6000, 17000),
    visionScore: randInt(8, 45),
    individualPosition: position,
    teamPosition: position,
    totalDamageDealtToChampions: randInt(8000, 32000),
    totalDamageTaken: randInt(7000, 28000),
    wardsPlaced: randInt(3, 18),
    wardsKilled: randInt(0, 8),
    item0: pick(ITEM_IDS),
    item1: pick(ITEM_IDS),
    item2: pick(ITEM_IDS),
    item3: pick(ITEM_IDS),
    item4: pick(ITEM_IDS),
    item5: pick(ITEM_IDS),
    item6: pick([3340, 3364, 2055]),
    perks: {
      statPerks: { defense: 5002, flex: 5008, offense: 5005 },
      styles: [
        {
          description: "primaryStyle",
          style: 8200,
          selections: [
            { perk: pick(KEYSTONES).id, var1: 0, var2: 0, var3: 0 },
            { perk: 8226, var1: 0, var2: 0, var3: 0 },
            { perk: 8233, var1: 0, var2: 0, var3: 0 },
            { perk: 8237, var1: 0, var2: 0, var3: 0 },
          ],
        },
        {
          description: "subStyle",
          style: 8300,
          selections: [
            { perk: 8304, var1: 0, var2: 0, var3: 0 },
            { perk: 8345, var1: 0, var2: 0, var3: 0 },
          ],
        },
      ],
    },
  };
}

function buildFakeRawMatchJson(
  m: {
    matchId: string;
    champion: { id: number; name: string };
    keystone: { id: number; name: string };
    result: "Victory" | "Defeat" | "Remake";
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    durationSeconds: number;
    goldEarned: number;
    visionScore: number;
    matchup: { id: number; name: string };
    position: string;
    gameDate: Date;
  },
  user: { puuid: string; riotGameName: string; riotTagLine: string },
): string {
  const userTeamId = 100;
  const enemyTeamId = 200;
  const userWin = m.result === "Victory";

  const participants: Record<string, unknown>[] = [];

  participants.push({
    puuid: user.puuid,
    summonerName: user.riotGameName,
    riotIdGameName: user.riotGameName,
    riotIdTagline: user.riotTagLine,
    championId: m.champion.id,
    championName: m.champion.name,
    teamId: userTeamId,
    win: userWin,
    kills: m.kills,
    deaths: m.deaths,
    assists: m.assists,
    totalMinionsKilled: Math.round(m.cs * 0.8),
    neutralMinionsKilled: Math.round(m.cs * 0.2),
    goldEarned: m.goldEarned,
    visionScore: m.visionScore,
    individualPosition: m.position,
    teamPosition: m.position,
    totalDamageDealtToChampions: randInt(10000, 35000),
    totalDamageTaken: randInt(8000, 25000),
    wardsPlaced: randInt(5, 20),
    wardsKilled: randInt(1, 10),
    item0: pick(ITEM_IDS),
    item1: pick(ITEM_IDS),
    item2: pick(ITEM_IDS),
    item3: pick(ITEM_IDS),
    item4: pick(ITEM_IDS),
    item5: pick(ITEM_IDS),
    item6: pick([3340, 3364, 2055]),
    perks: {
      statPerks: { defense: 5002, flex: 5008, offense: 5005 },
      styles: [
        {
          description: "primaryStyle",
          style: 8200,
          selections: [
            { perk: m.keystone.id, var1: 0, var2: 0, var3: 0 },
            { perk: 8226, var1: 0, var2: 0, var3: 0 },
            { perk: 8233, var1: 0, var2: 0, var3: 0 },
            { perk: 8237, var1: 0, var2: 0, var3: 0 },
          ],
        },
        {
          description: "subStyle",
          style: 8300,
          selections: [
            { perk: 8304, var1: 0, var2: 0, var3: 0 },
            { perk: 8345, var1: 0, var2: 0, var3: 0 },
          ],
        },
      ],
    },
  });

  const usedChampions = new Set([m.champion.id, m.matchup.id]);
  const allyPositions = POSITIONS.filter((p) => p !== m.position);
  for (let i = 0; i < 4; i++) {
    const champ = pickUnique(usedChampions);
    participants.push(
      makeFakeParticipant(champ, userTeamId, userWin, allyPositions[i], FAKE_NAMES[i], m),
    );
  }

  const enemyPositions = [...POSITIONS];
  const matchupPosIdx = enemyPositions.indexOf(m.position);
  participants.push(
    makeFakeParticipant(
      m.matchup,
      enemyTeamId,
      !userWin,
      enemyPositions[matchupPosIdx],
      FAKE_NAMES[4],
      m,
    ),
  );
  usedChampions.add(m.matchup.id);

  for (let i = 0; i < 4; i++) {
    const pos = enemyPositions.filter((p) => p !== m.position)[i];
    const champ = pickUnique(usedChampions);
    participants.push(makeFakeParticipant(champ, enemyTeamId, !userWin, pos, FAKE_NAMES[5 + i], m));
  }

  return JSON.stringify({
    metadata: {
      matchId: m.matchId,
      participants: participants.map((p) => p.puuid as string),
    },
    info: {
      gameCreation: m.gameDate.getTime(),
      gameDuration: m.durationSeconds,
      gameEndedInEarlySurrender: m.result === "Remake",
      gameId: parseInt(m.matchId.replace("EUW1_", "")),
      queueId: 420,
      participants,
    },
  });
}

const SUPPORT_CHAMPIONS = [
  { id: 412, name: "Thresh" },
  { id: 12, name: "Alistar" },
  { id: 89, name: "Leona" },
  { id: 53, name: "Blitzcrank" },
  { id: 117, name: "Lulu" },
  { id: 267, name: "Nami" },
] as const;

// Map old seed topic names → topic slugs (from migration 0029)
const TOPIC_SLUG_MAP: Record<string, string> = {
  Laning: "laning-phase",
  "Wave management": "wave-management",
  Roaming: "roaming-map-awareness",
  "Team fighting": "teamfighting",
  "Vision control": "vision-control",
  "CS improvement": "laning-phase",
  "Trading patterns": "trading-patterns",
  "Back timing": "laning-phase",
  "Objective control": "macro-objectives",
  "Matchup knowledge": "champion-specific-mechanics",
  Mentality: "mental-tilt-management",
  "Build paths": "build-paths",
  // Direct name matches
  "Laning phase": "laning-phase",
  Teamfighting: "teamfighting",
  "Roaming/map awareness": "roaming-map-awareness",
  "Macro/objectives": "macro-objectives",
  "Mental/tilt management": "mental-tilt-management",
  "Champion-specific mechanics": "champion-specific-mechanics",
};

// ─── Fixed IDs ───────────────────────────────────────────────────────────────

const ADMIN_USER_ID = "seed-user-0004-0004-000000000004";
const MAIN_USER_ID = "seed-user-0001-0001-000000000001";
const DUO_USER_ID = "seed-user-0002-0002-000000000002";
const NEW_PLAYER_ID = "seed-user-0003-0003-000000000003";

const MAIN_RIOT_ACCOUNT_ID = "seed-riot-acct-0001-000000000001";
const MAIN_SMURF_ACCOUNT_ID = "seed-riot-acct-0003-000000000003";
const DUO_RIOT_ACCOUNT_ID = "seed-riot-acct-0002-000000000002";

const MAIN_USER = {
  id: MAIN_USER_ID,
  discordId: "seed_discord_001",
  name: "DemoPlayer",
  image: null,
  email: "demo@example.com",
  riotGameName: "DemoPlayer",
  riotTagLine: "EUW",
  puuid: "seed-puuid-main-0000000000000000000000000000000000000000",
  summonerId: "seed-summoner-main",
  duoPartnerUserId: DUO_USER_ID,
  region: "euw1",
  onboardingCompleted: true,
  locale: "en-GB",
  language: "en",
  role: "premium" as const,
  primaryRole: "MIDDLE",
  secondaryRole: "BOTTOM",
  activeRiotAccountId: MAIN_RIOT_ACCOUNT_ID,
};

const DUO_USER = {
  id: DUO_USER_ID,
  discordId: "seed_discord_002",
  name: "DuoPartner",
  image: null,
  email: "duo@example.com",
  riotGameName: "DuoPartner",
  riotTagLine: "EUW",
  puuid: "seed-puuid-duo-00000000000000000000000000000000000000000",
  summonerId: "seed-summoner-duo",
  duoPartnerUserId: MAIN_USER_ID,
  region: "euw1",
  onboardingCompleted: true,
  locale: "en-GB",
  language: "en",
  role: "premium" as const,
  primaryRole: "UTILITY",
  secondaryRole: "MIDDLE",
  activeRiotAccountId: DUO_RIOT_ACCOUNT_ID,
};

const NEW_PLAYER = {
  id: NEW_PLAYER_ID,
  discordId: "seed_discord_003",
  name: "NewPlayer",
  image: null,
  email: "newplayer@example.com",
  riotGameName: null,
  riotTagLine: null,
  puuid: null,
  summonerId: null,
  duoPartnerUserId: null,
  region: null,
  onboardingCompleted: false,
  locale: "en-GB",
  language: "en",
  role: "free" as const,
  primaryRole: null,
  secondaryRole: null,
  activeRiotAccountId: null,
};

const ADMIN_USER = {
  id: ADMIN_USER_ID,
  discordId: "seed_discord_004",
  name: "AdminUser",
  image: null,
  email: "admin@example.com",
  riotGameName: null,
  riotTagLine: null,
  puuid: null,
  summonerId: null,
  duoPartnerUserId: null,
  region: null,
  onboardingCompleted: true,
  locale: "en-GB",
  language: "en",
  role: "admin" as const,
  primaryRole: null,
  secondaryRole: null,
  activeRiotAccountId: null,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// ─── Seed Script ─────────────────────────────────────────────────────────────

async function seed() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./data/lol-tracker.db";
  const dbToken = process.env.TURSO_AUTH_TOKEN;
  const isRemote = dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://");
  const forceRemote = process.argv.includes("--force-remote");
  const vercelEnv = process.env.VERCEL_ENV;

  // Hard block: NEVER seed production, regardless of flags
  if (vercelEnv === "production") {
    console.error("ERROR: Seeding is forbidden in production. Aborting.");
    process.exit(1);
  }

  // Safety guard: refuse to seed a remote database without explicit opt-in
  if (isRemote && !forceRemote) {
    console.error("ERROR: Refusing to seed a remote database without --force-remote flag.");
    console.error(`  Target: ${dbUrl}`);
    console.error("");
    console.error("This is a safety measure to prevent accidentally wiping production data.");
    console.error("If you are sure this is the right database, re-run with:");
    console.error(
      `  TURSO_DATABASE_URL="${dbUrl}" TURSO_AUTH_TOKEN=... npm run db:seed -- --force-remote`,
    );
    process.exit(1);
  }

  if (isRemote) {
    console.warn("WARNING: Seeding REMOTE database (--force-remote was passed)");
  }

  console.log(`Seeding database: ${dbUrl}`);

  const client = createClient({ url: dbUrl, authToken: dbToken });

  // Clear existing data (order matters for foreign keys).
  // Tables are created by migrations (scripts/migrate.ts) — this script
  // only handles data.
  console.log("Clearing existing data...");
  await client.executeMultiple(`
    DELETE FROM ai_insights;
    DELETE FROM matchup_notes;
    DELETE FROM goals;
    DELETE FROM challenge_topics;
    DELETE FROM challenges;
    DELETE FROM match_highlights;
    DELETE FROM coaching_action_items;
    DELETE FROM coaching_session_topics;
    DELETE FROM coaching_session_matches;
    DELETE FROM coaching_sessions;
    DELETE FROM rank_snapshots;
    DELETE FROM matches;
    DELETE FROM invites;
    DELETE FROM riot_accounts;
    DELETE FROM users;
  `);

  // ─── Load topic IDs (populated by migration 0029) ─────────────────────
  console.log("Loading topics...");
  const topicRows = await client.execute("SELECT id, slug FROM topics");
  const topicIdBySlug = new Map<string, number>();
  for (const row of topicRows.rows) {
    topicIdBySlug.set(row.slug as string, row.id as number);
  }

  function topicId(oldName: string): number {
    const slug = TOPIC_SLUG_MAP[oldName];
    if (!slug) throw new Error(`No slug mapping for topic "${oldName}"`);
    const id = topicIdBySlug.get(slug);
    if (id == null) throw new Error(`Topic slug "${slug}" not found in DB — run migrations first`);
    return id;
  }

  // ─── Users ───────────────────────────────────────────────────────────────
  console.log("Creating users...");
  const now = new Date("2026-03-25T10:00:00Z");

  for (const u of [ADMIN_USER, MAIN_USER, DUO_USER, NEW_PLAYER]) {
    await client.execute({
      sql: `INSERT INTO users (id, discord_id, name, image, email, riot_game_name, riot_tag_line, puuid, summoner_id, duo_partner_user_id, region, onboarding_completed, locale, language, role, primary_role, secondary_role, active_riot_account_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        u.id,
        u.discordId,
        u.name,
        u.image,
        u.email,
        u.riotGameName,
        u.riotTagLine,
        u.puuid,
        u.summonerId,
        u.duoPartnerUserId,
        u.region,
        u.onboardingCompleted ? 1 : 0,
        u.locale,
        u.language,
        u.role,
        u.primaryRole,
        u.secondaryRole,
        u.activeRiotAccountId,
        ts(now),
        ts(now),
      ],
    });
  }

  // ─── Invites ─────────────────────────────────────────────────────────────
  console.log("Creating invites...");
  await client.execute({
    sql: `INSERT INTO invites (code, created_by, used_by, used_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: ["DEMO-INVITE-001", MAIN_USER_ID, DUO_USER_ID, ts(now), ts(now)],
  });
  await client.execute({
    sql: `INSERT INTO invites (code, created_by, used_by, used_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: ["DEMO-INVITE-002", MAIN_USER_ID, NEW_PLAYER_ID, ts(now), ts(now)],
  });

  // ─── Riot Accounts ──────────────────────────────────────────────────────
  console.log("Creating riot accounts...");

  await client.execute({
    sql: `INSERT INTO riot_accounts (id, user_id, puuid, riot_game_name, riot_tag_line, summoner_id, region, is_primary, discoverable, label, primary_role, secondary_role, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      MAIN_RIOT_ACCOUNT_ID,
      MAIN_USER_ID,
      MAIN_USER.puuid,
      MAIN_USER.riotGameName,
      MAIN_USER.riotTagLine,
      MAIN_USER.summonerId,
      MAIN_USER.region,
      1,
      1,
      null,
      MAIN_USER.primaryRole,
      MAIN_USER.secondaryRole,
      ts(now),
    ],
  });

  // Smurf account for main user (to show account switcher in demo)
  await client.execute({
    sql: `INSERT INTO riot_accounts (id, user_id, puuid, riot_game_name, riot_tag_line, summoner_id, region, is_primary, discoverable, label, primary_role, secondary_role, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      MAIN_SMURF_ACCOUNT_ID,
      MAIN_USER_ID,
      "seed-puuid-smurf-000000000000000000000000000000000000000",
      "SmurfAccount",
      "EUW",
      "seed-summoner-smurf",
      "euw1",
      0,
      0,
      "Smurf",
      "TOP",
      "JUNGLE",
      ts(now),
    ],
  });

  await client.execute({
    sql: `INSERT INTO riot_accounts (id, user_id, puuid, riot_game_name, riot_tag_line, summoner_id, region, is_primary, discoverable, label, primary_role, secondary_role, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      DUO_RIOT_ACCOUNT_ID,
      DUO_USER_ID,
      DUO_USER.puuid,
      DUO_USER.riotGameName,
      DUO_USER.riotTagLine,
      DUO_USER.summonerId,
      DUO_USER.region,
      1,
      1,
      null,
      DUO_USER.primaryRole,
      DUO_USER.secondaryRole,
      ts(now),
    ],
  });

  // ─── Matches ─────────────────────────────────────────────────────────────
  console.log("Creating matches...");

  // Generate ~50 matches over ~2.5 months (Jan 10 – Mar 25, 2026)
  const matchStart = new Date("2026-01-10T18:00:00Z");
  const matchEnd = new Date("2026-03-25T08:00:00Z");
  const totalMatches = 50;
  const timeSpan = matchEnd.getTime() - matchStart.getTime();

  interface SeedMatch {
    matchId: string;
    gameDate: Date;
    champion: { id: number; name: string };
    keystone: { id: number; name: string };
    result: "Victory" | "Defeat" | "Remake";
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    csPerMin: number;
    durationSeconds: number;
    goldEarned: number;
    visionScore: number;
    matchup: { id: number; name: string };
    hasDuo: boolean;
    duoChampion: { id: number; name: string } | null;
    duoKills: number;
    duoDeaths: number;
    duoAssists: number;
    reviewed: boolean;
    comment: string | null;
    reviewNotes: string | null;
    reviewSkipped: string | null;
    odometer: number;
    position: string;
  }

  const seedMatches: SeedMatch[] = [];

  for (let i = 0; i < totalMatches; i++) {
    const gameDate = new Date(
      matchStart.getTime() + (timeSpan / totalMatches) * i + randInt(0, 3600000),
    );
    // ~5% remakes, then ~55% win rate among non-remakes (slightly positive, climbing)
    const resultRoll = rand();
    const result: "Victory" | "Defeat" | "Remake" =
      resultRoll < 0.05 ? "Remake" : resultRoll < 0.05 + 0.95 * 0.55 ? "Victory" : "Defeat";
    const isRemake = result === "Remake";

    // Remakes are very short (2-3 min); real games 20-40 min
    const durationSeconds = isRemake ? randInt(120, 210) : randInt(1200, 2400);
    const durationMin = durationSeconds / 60;

    // Main user plays from their pool 70% of the time
    const champion = rand() < 0.7 ? pick(MAIN_POOL) : pick(CHAMPIONS);
    const keystone = pick(KEYSTONES);
    const matchup = pick(CHAMPIONS.filter((c) => c.id !== champion.id));

    // Position: ~70% mid, ~15% bot (secondary), ~15% off-role
    const posRoll = rand();
    const position =
      posRoll < 0.7 ? "MIDDLE" : posRoll < 0.85 ? "BOTTOM" : pick(["TOP", "JUNGLE", "UTILITY"]);

    // Remakes have minimal stats
    const kills = isRemake ? 0 : randInt(1, 15);
    const deaths = isRemake ? 0 : randInt(0, 10);
    const assists = isRemake ? 0 : randInt(1, 18);
    const cs = isRemake ? 0 : Math.round(durationMin * (5 + rand() * 4)); // 5–9 cs/min
    const csPerMin = isRemake ? 0 : Math.round((cs / durationMin) * 10) / 10;
    const goldEarned = isRemake ? randInt(500, 1000) : randInt(7000, 18000);
    const visionScore = isRemake ? randInt(0, 3) : randInt(10, 50);

    // Duo partner appears in ~40% of matches
    const hasDuo = rand() < 0.4;
    const duoChampion = hasDuo ? pick(SUPPORT_CHAMPIONS) : null;

    // ~30% reviewed, ~10% skipped, rest unreviewed (remakes never reviewed)
    const reviewRoll = rand();
    const reviewed = isRemake ? false : reviewRoll < 0.3;
    const skipped = isRemake ? false : reviewRoll >= 0.3 && reviewRoll < 0.4;

    seedMatches.push({
      matchId: `EUW1_${7000000000 + i}`,
      gameDate,
      champion,
      keystone,
      result,
      kills,
      deaths,
      assists,
      cs,
      csPerMin,
      durationSeconds,
      goldEarned,
      visionScore,
      matchup,
      hasDuo,
      duoChampion,
      duoKills: hasDuo ? randInt(0, 8) : 0,
      duoDeaths: hasDuo ? randInt(0, 8) : 0,
      duoAssists: hasDuo ? randInt(2, 20) : 0,
      reviewed,
      comment:
        reviewed && rand() < 0.6
          ? pick([
              "Good wave management this game",
              "Should have roamed more after pushing",
              "Team fights went well, positioning was solid",
              "Got caught warding alone twice — need to be more careful",
              "Lane phase was rough but recovered well",
              "Good TP plays this game",
            ])
          : null,
      reviewNotes: reviewed
        ? pick([
            "Focus on cs leads in the first 5 minutes",
            "Back timings were off — lost waves unnecessarily",
            "Vision control around dragon was excellent",
            "Died to ganks — check minimap before trading",
            "Good roam timing, keep it up",
          ])
        : null,
      reviewSkipped: skipped
        ? pick([
            "Already know what went wrong",
            "Remake / short game",
            "Not much to learn from this one",
          ])
        : null,
      odometer: i + 1,
      position,
    });
  }

  for (const m of seedMatches) {
    await client.execute({
      sql: `INSERT INTO matches (
              id, odometer, user_id, riot_account_id, game_date, result,
              champion_id, champion_name, rune_keystone_id, rune_keystone_name,
              matchup_champion_id, matchup_champion_name,
              kills, deaths, assists, cs, cs_per_min,
              game_duration_seconds, gold_earned, vision_score,
              comment, reviewed, review_notes, review_skipped_reason,
              queue_id, position, synced_at, raw_match_json,
              duo_partner_puuid, duo_partner_champion_name,
              duo_partner_kills, duo_partner_deaths, duo_partner_assists
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.matchId,
        m.odometer,
        MAIN_USER_ID,
        MAIN_RIOT_ACCOUNT_ID,
        ts(m.gameDate),
        m.result,
        m.champion.id,
        m.champion.name,
        m.keystone.id,
        m.keystone.name,
        m.matchup.id,
        m.matchup.name,
        m.kills,
        m.deaths,
        m.assists,
        m.cs,
        m.csPerMin,
        m.durationSeconds,
        m.goldEarned,
        m.visionScore,
        m.comment,
        m.reviewed ? 1 : 0,
        m.reviewNotes,
        m.reviewSkipped,
        420,
        m.position,
        ts(m.gameDate),
        m.result === "Remake" ? null : buildFakeRawMatchJson(m, MAIN_USER),
        m.hasDuo ? DUO_USER.puuid : null,
        m.duoChampion?.name ?? null,
        m.hasDuo ? m.duoKills : null,
        m.hasDuo ? m.duoDeaths : null,
        m.hasDuo ? m.duoAssists : null,
      ],
    });
  }

  // ─── Duo Partner Matches ──────────────────────────────────────────────────
  // DuoPartner gets matches too, so you can test features like AI insights
  // while logged in as the premium user. Shared games reuse the same Riot
  // match ID (composite PK allows this), and DuoPartner also has solo games.

  const duoMatches: Array<{
    matchId: string;
    odometer: number;
    gameDate: Date;
    champion: { id: number; name: string };
    keystone: { id: number; name: string };
    result: "Victory" | "Defeat" | "Remake";
    kills: number;
    deaths: number;
    assists: number;
    cs: number;
    csPerMin: number;
    durationSeconds: number;
    goldEarned: number;
    visionScore: number;
    matchup: { id: number; name: string };
    hasDuo: boolean;
    position: string;
    reviewed: boolean;
    comment: string | null;
    reviewNotes: string | null;
    reviewSkipped: string | null;
  }> = [];

  let duoOdometer = 0;

  // 1) Mirror shared games — main user's matches where hasDuo=true
  for (const m of seedMatches) {
    if (!m.hasDuo) continue;
    duoOdometer++;

    const supportChamp = pick(SUPPORT_CHAMPIONS);
    const matchup = pick(SUPPORT_CHAMPIONS.filter((c) => c.id !== supportChamp.id));
    const isRemake = m.result === "Remake";

    // Support stats: fewer kills, more assists, lower cs
    const kills = isRemake ? 0 : randInt(0, 5);
    const deaths = isRemake ? 0 : randInt(1, 8);
    const assists = isRemake ? 0 : randInt(5, 22);
    const durationMin = m.durationSeconds / 60;
    const cs = isRemake ? 0 : Math.round(durationMin * (1 + rand() * 2)); // 1–3 cs/min (support)
    const csPerMin = isRemake ? 0 : Math.round((cs / durationMin) * 10) / 10;

    const reviewRoll = rand();
    const reviewed = isRemake ? false : reviewRoll < 0.25;
    const skipped = isRemake ? false : reviewRoll >= 0.25 && reviewRoll < 0.35;

    duoMatches.push({
      matchId: m.matchId, // same Riot match — both players were in this game
      odometer: duoOdometer,
      gameDate: m.gameDate,
      champion: supportChamp,
      keystone: pick(KEYSTONES),
      result: m.result, // same outcome
      kills,
      deaths,
      assists,
      cs,
      csPerMin,
      durationSeconds: m.durationSeconds,
      goldEarned: isRemake ? randInt(400, 800) : randInt(5000, 12000),
      visionScore: isRemake ? randInt(0, 3) : randInt(20, 70), // supports ward more
      matchup,
      hasDuo: true, // main user is the duo partner from this perspective
      position: "UTILITY",
      reviewed,
      comment:
        reviewed && rand() < 0.5
          ? pick([
              "Good peel in team fights",
              "Roam timings were solid",
              "Should have warded dragon pit earlier",
              "Engage timing was off in the baron fight",
              "Lane presence was strong, zoned well",
            ])
          : null,
      reviewNotes: reviewed
        ? pick([
            "Work on roam timing after ADC backs",
            "Vision score was excellent this game",
            "Engage timing needs improvement",
            "Good lane control with bushes",
          ])
        : null,
      reviewSkipped: skipped ? pick(["Short game", "Nothing new to note"]) : null,
    });
  }

  // 2) Solo games for DuoPartner (without the main user)
  const duoSoloCount = 10;
  const soloStart = new Date("2026-01-15T20:00:00Z");
  const soloEnd = new Date("2026-03-20T22:00:00Z");
  const soloSpan = soloEnd.getTime() - soloStart.getTime();

  for (let i = 0; i < duoSoloCount; i++) {
    duoOdometer++;
    const gameDate = new Date(
      soloStart.getTime() + (soloSpan / duoSoloCount) * i + randInt(0, 3600000),
    );
    const resultRoll = rand();
    const result: "Victory" | "Defeat" | "Remake" =
      resultRoll < 0.04 ? "Remake" : resultRoll < 0.04 + 0.96 * 0.5 ? "Victory" : "Defeat";
    const isRemake = result === "Remake";
    const durationSeconds = isRemake ? randInt(120, 210) : randInt(1200, 2400);
    const durationMin = durationSeconds / 60;

    const champion = pick(SUPPORT_CHAMPIONS);
    const matchup = pick(SUPPORT_CHAMPIONS.filter((c) => c.id !== champion.id));

    const kills = isRemake ? 0 : randInt(0, 6);
    const deaths = isRemake ? 0 : randInt(1, 9);
    const assists = isRemake ? 0 : randInt(4, 20);
    const cs = isRemake ? 0 : Math.round(durationMin * (1 + rand() * 2));
    const csPerMin = isRemake ? 0 : Math.round((cs / durationMin) * 10) / 10;

    const reviewRoll = rand();
    const reviewed = isRemake ? false : reviewRoll < 0.2;
    const skipped = isRemake ? false : reviewRoll >= 0.2 && reviewRoll < 0.3;

    duoMatches.push({
      matchId: `EUW1_${8000000000 + i}`, // separate match IDs (solo games)
      odometer: duoOdometer,
      gameDate,
      champion,
      keystone: pick(KEYSTONES),
      result,
      kills,
      deaths,
      assists,
      cs,
      csPerMin,
      durationSeconds,
      goldEarned: isRemake ? randInt(400, 800) : randInt(5000, 12000),
      visionScore: isRemake ? randInt(0, 3) : randInt(15, 60),
      matchup,
      hasDuo: false,
      position: rand() < 0.8 ? "UTILITY" : pick(["MIDDLE", "BOTTOM"]),
      reviewed,
      comment:
        reviewed && rand() < 0.5
          ? pick([
              "Played well from behind",
              "Good roam bot after first back",
              "Need to track enemy jungler better",
            ])
          : null,
      reviewNotes: reviewed
        ? pick([
            "Focus on level 2 all-in timing",
            "Ward coverage was lacking this game",
            "Good engage patience in team fights",
          ])
        : null,
      reviewSkipped: skipped ? pick(["Quick game", "Nothing notable"]) : null,
    });
  }

  const totalDuoMatches = duoMatches.length;

  for (const m of duoMatches) {
    await client.execute({
      sql: `INSERT INTO matches (
              id, odometer, user_id, riot_account_id, game_date, result,
              champion_id, champion_name, rune_keystone_id, rune_keystone_name,
              matchup_champion_id, matchup_champion_name,
              kills, deaths, assists, cs, cs_per_min,
              game_duration_seconds, gold_earned, vision_score,
              comment, reviewed, review_notes, review_skipped_reason,
              queue_id, position, synced_at, raw_match_json,
              duo_partner_puuid, duo_partner_champion_name,
              duo_partner_kills, duo_partner_deaths, duo_partner_assists
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.matchId,
        m.odometer,
        DUO_USER_ID,
        DUO_RIOT_ACCOUNT_ID,
        ts(m.gameDate),
        m.result,
        m.champion.id,
        m.champion.name,
        m.keystone.id,
        m.keystone.name,
        m.matchup.id,
        m.matchup.name,
        m.kills,
        m.deaths,
        m.assists,
        m.cs,
        m.csPerMin,
        m.durationSeconds,
        m.goldEarned,
        m.visionScore,
        m.comment,
        m.reviewed ? 1 : 0,
        m.reviewNotes,
        m.reviewSkipped,
        420,
        m.position,
        ts(m.gameDate),
        m.result === "Remake" ? null : buildFakeRawMatchJson(m, DUO_USER),
        m.hasDuo ? MAIN_USER.puuid : null,
        m.hasDuo ? pick(MAIN_POOL).name : null,
        m.hasDuo ? randInt(2, 12) : null,
        m.hasDuo ? randInt(1, 8) : null,
        m.hasDuo ? randInt(1, 15) : null,
      ],
    });
  }

  // ─── Rank Snapshots ──────────────────────────────────────────────────────
  console.log("Creating rank snapshots...");

  // Simulate a climb from Silver I 50 LP -> Gold III ~60 LP over the season
  const rankProgression = [
    { date: "2026-01-10", tier: "SILVER", division: "I", lp: 50, wins: 12, losses: 10 },
    { date: "2026-01-17", tier: "SILVER", division: "I", lp: 72, wins: 16, losses: 12 },
    { date: "2026-01-24", tier: "SILVER", division: "I", lp: 95, wins: 20, losses: 14 },
    { date: "2026-01-31", tier: "GOLD", division: "IV", lp: 15, wins: 24, losses: 17 },
    { date: "2026-02-07", tier: "GOLD", division: "IV", lp: 42, wins: 28, losses: 19 },
    { date: "2026-02-14", tier: "GOLD", division: "IV", lp: 30, wins: 31, losses: 23 },
    { date: "2026-02-21", tier: "GOLD", division: "IV", lp: 68, wins: 35, losses: 25 },
    { date: "2026-02-28", tier: "GOLD", division: "IV", lp: 92, wins: 39, losses: 27 },
    { date: "2026-03-04", tier: "GOLD", division: "III", lp: 18, wins: 42, losses: 29 },
    { date: "2026-03-10", tier: "GOLD", division: "III", lp: 5, wins: 44, losses: 33 },
    { date: "2026-03-14", tier: "GOLD", division: "III", lp: 35, wins: 47, losses: 34 },
    { date: "2026-03-18", tier: "GOLD", division: "III", lp: 48, wins: 50, losses: 36 },
    { date: "2026-03-22", tier: "GOLD", division: "III", lp: 55, wins: 53, losses: 38 },
    { date: "2026-03-25", tier: "GOLD", division: "III", lp: 62, wins: 55, losses: 39 },
  ];

  for (const snap of rankProgression) {
    await client.execute({
      sql: `INSERT INTO rank_snapshots (user_id, riot_account_id, captured_at, tier, division, lp, wins, losses)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        MAIN_USER_ID,
        MAIN_RIOT_ACCOUNT_ID,
        ts(new Date(snap.date + "T12:00:00Z")),
        snap.tier,
        snap.division,
        snap.lp,
        snap.wins,
        snap.losses,
      ],
    });
  }

  // Duo partner rank snapshots — Support main climbing from Bronze I to Silver II
  const duoRankProgression = [
    { date: "2026-01-10", tier: "BRONZE", division: "I", lp: 65, wins: 10, losses: 12 },
    { date: "2026-01-17", tier: "BRONZE", division: "I", lp: 82, wins: 14, losses: 14 },
    { date: "2026-01-24", tier: "BRONZE", division: "I", lp: 98, wins: 18, losses: 15 },
    { date: "2026-01-31", tier: "SILVER", division: "IV", lp: 20, wins: 22, losses: 18 },
    { date: "2026-02-07", tier: "SILVER", division: "IV", lp: 55, wins: 26, losses: 20 },
    { date: "2026-02-14", tier: "SILVER", division: "IV", lp: 40, wins: 28, losses: 24 },
    { date: "2026-02-21", tier: "SILVER", division: "IV", lp: 78, wins: 32, losses: 26 },
    { date: "2026-02-28", tier: "SILVER", division: "III", lp: 10, wins: 36, losses: 28 },
    { date: "2026-03-04", tier: "SILVER", division: "III", lp: 42, wins: 39, losses: 30 },
    { date: "2026-03-10", tier: "SILVER", division: "III", lp: 30, wins: 41, losses: 33 },
    { date: "2026-03-14", tier: "SILVER", division: "III", lp: 65, wins: 44, losses: 35 },
    { date: "2026-03-18", tier: "SILVER", division: "II", lp: 8, wins: 47, losses: 37 },
    { date: "2026-03-22", tier: "SILVER", division: "II", lp: 25, wins: 49, losses: 39 },
    { date: "2026-03-25", tier: "SILVER", division: "II", lp: 38, wins: 51, losses: 40 },
  ];

  for (const snap of duoRankProgression) {
    await client.execute({
      sql: `INSERT INTO rank_snapshots (user_id, riot_account_id, captured_at, tier, division, lp, wins, losses)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DUO_USER_ID,
        DUO_RIOT_ACCOUNT_ID,
        ts(new Date(snap.date + "T12:00:00Z")),
        snap.tier,
        snap.division,
        snap.lp,
        snap.wins,
        snap.losses,
      ],
    });
  }

  // ─── Coaching Sessions ───────────────────────────────────────────────────
  console.log("Creating coaching sessions...");

  const sessions = [
    {
      coachName: "CoachKim",
      date: "2026-02-10T14:00:00Z",
      status: "completed",
      durationMinutes: 60,
      topicNames: ["Laning", "Wave management", "Trading patterns"],
      notes: "Focused on early lane control. Key takeaway: slow push into roam timing.",
      matchIds: ["EUW1_7000000010", "EUW1_7000000012"],
    },
    {
      coachName: "CoachKim",
      date: "2026-03-05T15:00:00Z",
      status: "completed",
      durationMinutes: 45,
      topicNames: ["Team fighting", "Vision control"],
      notes:
        "Reviewed team fight positioning. Need to stay further back and use abilities from max range.",
      matchIds: ["EUW1_7000000030", "EUW1_7000000032", "EUW1_7000000035"],
    },
    {
      coachName: "CoachKim",
      date: "2026-03-28T16:00:00Z",
      status: "scheduled",
      durationMinutes: null,
      topicNames: ["Roaming", "Objective control"],
      notes: null,
      matchIds: [],
    },
  ];

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const sessionId = i + 1;

    await client.execute({
      sql: `INSERT INTO coaching_sessions (id, user_id, coach_name, date, status, duration_minutes, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sessionId,
        MAIN_USER_ID,
        s.coachName,
        ts(new Date(s.date)),
        s.status,
        s.durationMinutes,
        s.notes,
        ts(new Date(s.date)),
        ts(new Date(s.date)),
      ],
    });

    // Insert session topics into join table
    for (const tName of s.topicNames) {
      await client.execute({
        sql: `INSERT INTO coaching_session_topics (session_id, topic_id) VALUES (?, ?)`,
        args: [sessionId, topicId(tName)],
      });
    }

    for (const matchId of s.matchIds) {
      await client.execute({
        sql: `INSERT INTO coaching_session_matches (session_id, match_id, user_id) VALUES (?, ?, ?)`,
        args: [sessionId, matchId, MAIN_USER_ID],
      });
    }
  }

  // ─── Action Items ────────────────────────────────────────────────────────
  console.log("Creating action items...");

  const actionItems = [
    // Session 1 items
    {
      sessionId: 1,
      desc: "Practice slow push -> crash -> roam pattern in 5 games",
      topicName: "Wave management",
      status: "completed",
      completedAt: "2026-02-20T10:00:00Z",
    },
    {
      sessionId: 1,
      desc: "Track opponent cooldowns before trading",
      topicName: "Trading patterns",
      status: "completed",
      completedAt: "2026-02-25T10:00:00Z",
    },
    {
      sessionId: 1,
      desc: "Review 3 VODs focusing on first 5 minutes",
      topicName: "Laning",
      status: "completed",
      completedAt: "2026-02-18T10:00:00Z",
    },
    // Session 2 items
    {
      sessionId: 2,
      desc: "Play 3 games focusing on max-range ability usage in team fights",
      topicName: "Team fighting",
      status: "in_progress",
      completedAt: null,
    },
    {
      sessionId: 2,
      desc: "Place 2+ control wards per game before dragon spawns",
      topicName: "Vision control",
      status: "in_progress",
      completedAt: null,
    },
    {
      sessionId: 2,
      desc: "Watch LCK mid lane team fight positioning VODs",
      topicName: "Team fighting",
      status: "pending",
      completedAt: null,
    },
  ];

  for (const item of actionItems) {
    await client.execute({
      sql: `INSERT INTO coaching_action_items (session_id, user_id, description, topic_id, status, completed_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.sessionId,
        MAIN_USER_ID,
        item.desc,
        topicId(item.topicName),
        item.status,
        item.completedAt ? ts(new Date(item.completedAt)) : null,
        ts(new Date("2026-02-10T14:00:00Z")),
      ],
    });
  }

  // ─── Match Highlights ────────────────────────────────────────────────────
  console.log("Creating match highlights...");

  const highlights = [
    {
      matchId: "EUW1_7000000005",
      type: "highlight",
      text: "Perfect wave freeze denied enemy 2 waves",
      topicName: "Wave management",
    },
    {
      matchId: "EUW1_7000000005",
      type: "lowlight",
      text: "Greeded for cannon and got chunked to 30%",
      topicName: "Laning",
    },
    {
      matchId: "EUW1_7000000010",
      type: "highlight",
      text: "3-man roam bot got us dragon + double kill",
      topicName: "Roaming",
    },
    {
      matchId: "EUW1_7000000015",
      type: "lowlight",
      text: "Died to gank with no vision — need to ward before pushing",
      topicName: "Vision control",
    },
    {
      matchId: "EUW1_7000000015",
      type: "highlight",
      text: "Solo killed matchup at level 6 with full combo",
      topicName: "Laning",
    },
    {
      matchId: "EUW1_7000000020",
      type: "highlight",
      text: "Team fight positioning was great — stayed max range entire fight",
      topicName: "Team fighting",
    },
    {
      matchId: "EUW1_7000000020",
      type: "lowlight",
      text: "Used flash aggressively when it wasn't needed",
      topicName: "Team fighting",
    },
    {
      matchId: "EUW1_7000000025",
      type: "highlight",
      text: "Won lane with good trades and back timing",
      topicName: "Laning",
    },
    {
      matchId: "EUW1_7000000030",
      type: "lowlight",
      text: "Walked into unwarded jungle and got collapsed on",
      topicName: "Vision control",
    },
    {
      matchId: "EUW1_7000000035",
      type: "highlight",
      text: "Set up slow push before dragon and got priority",
      topicName: "Wave management",
    },
    {
      matchId: "EUW1_7000000040",
      type: "lowlight",
      text: "Missed every skillshot in the baron fight",
      topicName: "Team fighting",
    },
    {
      matchId: "EUW1_7000000045",
      type: "highlight",
      text: "Clean 1v1 outplay under tower for first blood",
      topicName: "Laning",
    },
  ];

  for (const h of highlights) {
    await client.execute({
      sql: `INSERT INTO match_highlights (match_id, user_id, riot_account_id, type, text, topic_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        h.matchId,
        MAIN_USER_ID,
        MAIN_RIOT_ACCOUNT_ID,
        h.type,
        h.text,
        topicId(h.topicName),
        ts(now),
      ],
    });
  }

  // ─── Challenges ────────────────────────────────────────────────────────────
  console.log("Creating challenges...");

  // Challenge 1: Completed by-date — "Reach Gold IV" (started in Silver I, completed ~Feb 7)
  await client.execute({
    sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, target_tier, target_division, start_tier, start_division, start_lp, status, deadline, created_at, completed_at, failed_at, retired_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      MAIN_USER_ID,
      MAIN_RIOT_ACCOUNT_ID,
      "Reach Gold IV",
      "by-date",
      "GOLD",
      "IV",
      "SILVER",
      "I",
      50,
      "completed",
      null,
      ts(new Date("2026-01-10T18:00:00Z")),
      ts(new Date("2026-02-07T14:30:00Z")),
      null,
      null,
    ],
  });

  // Challenge 2: Active by-date — "Reach Platinum IV" (started in Gold III)
  await client.execute({
    sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, target_tier, target_division, start_tier, start_division, start_lp, status, deadline, created_at, completed_at, failed_at, retired_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      MAIN_USER_ID,
      MAIN_RIOT_ACCOUNT_ID,
      "Reach Platinum IV",
      "by-date",
      "PLATINUM",
      "IV",
      "GOLD",
      "III",
      5,
      "active",
      ts(new Date("2026-06-30T23:59:59Z")),
      ts(new Date("2026-03-10T10:00:00Z")),
      null,
      null,
      null,
    ],
  });

  // Challenge 3: Active by-games — "Keep CS/min above 7 for 10 games"
  // At 9/10 games with 9 successful — next match with cspm ≥ 7 completes it!
  await client.execute({
    sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, metric, metric_condition, metric_threshold, target_games, current_games, successful_games, status, created_at, completed_at, failed_at, retired_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      MAIN_USER_ID,
      MAIN_RIOT_ACCOUNT_ID,
      "CS/min at least 7 for 10 games",
      "by-games",
      "cspm",
      "at_least",
      7.0,
      10,
      9,
      9,
      "active",
      ts(new Date("2026-04-15T10:00:00Z")),
      null,
      null,
      null,
    ],
  });

  // Challenge 4: Active by-games — "Less than 5 deaths for 15 games"
  // At 14/15 games with 14 successful — next match with deaths > 5 fails it!
  await client.execute({
    sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, metric, metric_condition, metric_threshold, target_games, current_games, successful_games, status, created_at, completed_at, failed_at, retired_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      MAIN_USER_ID,
      MAIN_RIOT_ACCOUNT_ID,
      "At most 5 deaths for 15 games",
      "by-games",
      "deaths",
      "at_most",
      5,
      15,
      14,
      14,
      "active",
      ts(new Date("2026-04-12T14:00:00Z")),
      null,
      null,
      null,
    ],
  });

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("\nSeed complete!");
  console.log(`  Users:            4`);
  console.log(
    `  Matches:          ${totalMatches + totalDuoMatches} (${totalMatches} main + ${totalDuoMatches} duo)`,
  );
  console.log(`  Rank snapshots:   ${rankProgression.length + duoRankProgression.length}`);
  console.log(`  Coaching sessions: ${sessions.length}`);
  console.log(`  Action items:     ${actionItems.length}`);
  console.log(`  Highlights:       ${highlights.length}`);
  console.log(`  Challenges:       4`);
  console.log(`  Invites:          1`);
  console.log(`\nDemo user logins:`);
  console.log(`  ${ADMIN_USER.name} (admin, no Riot account, onboarding done)`);
  console.log(`  ${MAIN_USER.name} (premium, Riot linked, onboarding done)`);
  console.log(`  ${DUO_USER.name} (premium, Riot linked, onboarding done)`);
  console.log(`  ${NEW_PLAYER.name} (free, no Riot account, needs onboarding)`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
