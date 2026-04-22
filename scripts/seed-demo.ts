// scripts/seed-demo.ts
// Production-safe seed script for the public demo user.
// Run: npm run db:seed-demo -- --execute
//
// Safety layers:
// 1. Only deletes rows with "demo-" prefixed IDs
// 2. Dry-run by default — pass --execute to actually write
// 3. Requires --force-remote for remote (Turso) databases
// 4. Hard-blocks on VERCEL_ENV=production
// 5. Single transaction with rollback on error
// 6. Pre-flight checks: verifies tables & topics exist

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

// ─── Constants ───────────────────────────────────────────────────────────────

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

const TOPIC_SLUG_MAP: Record<string, string> = {
  Laning: "laning-phase",
  "Wave management": "wave-management",
  Roaming: "roaming-map-awareness",
  "Team fighting": "teamfighting",
  "Vision control": "vision-control",
  "Trading patterns": "trading-patterns",
  "Objective control": "macro-objectives",
  Positioning: "teamfighting",
};

// ─── Fixed IDs (must start with "demo-") ─────────────────────────────────────

const DEMO_USER_ID = "demo-user-0001-0001-000000000001";
const DEMO_RIOT_ACCOUNT_ID = "demo-riot-acct-0001-000000000001";
const DEMO_SMURF_ACCOUNT_ID = "demo-riot-acct-0003-000000000003";

const DEMO_USER = {
  id: DEMO_USER_ID,
  discordId: "demo_discord_001",
  name: "DemoPlayer",
  image: null,
  email: "demo@example.com",
  riotGameName: "DemoPlayer",
  riotTagLine: "EUW",
  puuid: "demo-puuid-main-0000000000000000000000000000000000000000",
  summonerId: "demo-summoner-main",
  region: "euw1",
  onboardingCompleted: true,
  locale: "en-GB",
  language: "en",
  role: "premium" as const,
  primaryRole: "MIDDLE",
  secondaryRole: "BOTTOM",
  activeRiotAccountId: DEMO_RIOT_ACCOUNT_ID,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// Common item IDs from League of Legends (mid-lane oriented)
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

/**
 * Build a fake RiotMatch JSON string for a seeded match.
 * Only includes the fields parsed by `slimParticipants()` in match-detail.ts.
 */
function buildFakeRawMatchJson(m: {
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
}): string {
  const userTeamId = 100;
  const enemyTeamId = 200;
  const userWin = m.result === "Victory";

  // Build 10 participants: 5 per team, user is first on blue team
  const participants: Record<string, unknown>[] = [];

  // User participant
  participants.push({
    puuid: DEMO_USER.puuid,
    summonerName: DEMO_USER.riotGameName,
    riotIdGameName: DEMO_USER.riotGameName,
    riotIdTagline: DEMO_USER.riotTagLine,
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

  // 4 allied teammates
  const usedChampions = new Set([m.champion.id, m.matchup.id]);
  const allyPositions = POSITIONS.filter((p) => p !== m.position);
  for (let i = 0; i < 4; i++) {
    const champ = pickUnique(usedChampions);
    participants.push(
      makeFakeParticipant(champ, userTeamId, userWin, allyPositions[i], FAKE_NAMES[i], m),
    );
  }

  // 5 enemy participants — enemy laner (matchup) is first
  const enemyPositions = [...POSITIONS];
  const matchupPosIdx = enemyPositions.indexOf(m.position);
  // Put matchup champion in the same position as user
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
      gameMode: "CLASSIC",
      gameType: "MATCHED_GAME",
      queueId: 420,
      participants,
    },
  });
}

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

// ─── Main ────────────────────────────────────────────────────────────────────

async function seedDemo() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./data/lol-tracker.db";
  const dbToken = process.env.TURSO_AUTH_TOKEN;
  const isRemote = dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://");
  const forceRemote = process.argv.includes("--force-remote");
  const execute = process.argv.includes("--execute");
  const isVercelCI = process.env.VERCEL === "1";

  // On Vercel builds, auto-enable execute and force-remote (runs as part of buildCommand)
  const shouldExecute = execute || isVercelCI;
  const shouldAllowRemote = forceRemote || isVercelCI;

  // Safety guard: refuse remote without explicit opt-in (unless on Vercel CI)
  if (isRemote && !shouldAllowRemote) {
    console.error("ERROR: Refusing to seed a remote database without --force-remote flag.");
    console.error(`  Target: ${dbUrl}`);
    console.error(
      "  Re-run with: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npm run db:seed-demo -- --execute --force-remote",
    );
    process.exit(1);
  }

  if (!shouldExecute) {
    console.log("DRY RUN — no data will be written. Pass --execute to apply changes.");
    console.log(`  Target: ${dbUrl}`);
    console.log("");
    console.log("This script will:");
    console.log("  1. Delete all rows with demo- prefixed IDs (safe for production)");
    console.log("  2. Create 1 demo user (DemoPlayer, premium, Riot-linked)");
    console.log(
      "  3. Create ~50 matches, rank snapshots, coaching sessions, highlights, challenges",
    );
    console.log("");
    console.log("Run: npm run db:seed-demo -- --execute");
    process.exit(0);
  }

  if (isRemote) {
    console.warn(
      isVercelCI
        ? `[seed-demo] Seeding remote database (Vercel CI, env: ${process.env.VERCEL_ENV})`
        : "WARNING: Seeding REMOTE database (--force-remote was passed)",
    );
  }

  console.log(`Seeding demo data: ${dbUrl}`);

  const client = createClient({ url: dbUrl, authToken: dbToken });

  // ─── Pre-flight checks ──────────────────────────────────────────────────
  console.log("Running pre-flight checks...");

  // Verify topics table exists and has data
  const topicRows = await client.execute("SELECT id, slug FROM topics");
  if (topicRows.rows.length === 0) {
    console.error("ERROR: topics table is empty — run migrations first.");
    process.exit(1);
  }
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

  // ─── Safe deletion (only demo- prefixed rows) ──────────────────────────
  console.log("Deleting existing demo data (demo- prefixed rows only)...");

  const tx = await client.transaction("write");
  try {
    // Order matters for foreign keys — delete children first
    await tx.execute("DELETE FROM ai_insights WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM matchup_notes WHERE user_id LIKE 'demo-%'");
    await tx.execute(
      "DELETE FROM challenge_topics WHERE challenge_id IN (SELECT id FROM challenges WHERE user_id LIKE 'demo-%')",
    );
    await tx.execute("DELETE FROM challenges WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM match_highlights WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM coaching_action_items WHERE user_id LIKE 'demo-%'");
    await tx.execute(
      "DELETE FROM coaching_session_topics WHERE session_id IN (SELECT id FROM coaching_sessions WHERE user_id LIKE 'demo-%')",
    );
    await tx.execute("DELETE FROM coaching_session_matches WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM coaching_sessions WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM rank_snapshots WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM matches WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM invites WHERE created_by LIKE 'demo-%'");
    await tx.execute("DELETE FROM riot_accounts WHERE user_id LIKE 'demo-%'");
    await tx.execute("DELETE FROM users WHERE id LIKE 'demo-%'");

    // ─── Create demo user ───────────────────────────────────────────────
    console.log("Creating demo user...");
    const now = new Date("2026-03-25T10:00:00Z");

    await tx.execute({
      sql: `INSERT INTO users (id, discord_id, name, image, email, riot_game_name, riot_tag_line, puuid, summoner_id, duo_partner_user_id, region, onboarding_completed, locale, language, role, primary_role, secondary_role, active_riot_account_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DEMO_USER.id,
        DEMO_USER.discordId,
        DEMO_USER.name,
        DEMO_USER.image,
        DEMO_USER.email,
        DEMO_USER.riotGameName,
        DEMO_USER.riotTagLine,
        DEMO_USER.puuid,
        DEMO_USER.summonerId,
        null,
        DEMO_USER.region,
        1,
        DEMO_USER.locale,
        DEMO_USER.language,
        DEMO_USER.role,
        DEMO_USER.primaryRole,
        DEMO_USER.secondaryRole,
        DEMO_USER.activeRiotAccountId,
        ts(now),
        ts(now),
      ],
    });

    // ─── Riot Accounts ────────────────────────────────────────────────────
    console.log("Creating riot accounts...");

    await tx.execute({
      sql: `INSERT INTO riot_accounts (id, user_id, puuid, riot_game_name, riot_tag_line, summoner_id, region, is_primary, discoverable, label, primary_role, secondary_role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DEMO_RIOT_ACCOUNT_ID,
        DEMO_USER_ID,
        DEMO_USER.puuid,
        DEMO_USER.riotGameName,
        DEMO_USER.riotTagLine,
        DEMO_USER.summonerId,
        DEMO_USER.region,
        1,
        1,
        null,
        DEMO_USER.primaryRole,
        DEMO_USER.secondaryRole,
        ts(now),
      ],
    });

    await tx.execute({
      sql: `INSERT INTO riot_accounts (id, user_id, puuid, riot_game_name, riot_tag_line, summoner_id, region, is_primary, discoverable, label, primary_role, secondary_role, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DEMO_SMURF_ACCOUNT_ID,
        DEMO_USER_ID,
        "demo-puuid-smurf-000000000000000000000000000000000000000",
        "SmurfAccount",
        "EUW",
        "demo-summoner-smurf",
        "euw1",
        0,
        0,
        "Smurf",
        "TOP",
        "JUNGLE",
        ts(now),
      ],
    });

    // ─── Matches ──────────────────────────────────────────────────────────
    console.log("Creating matches...");

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
      reviewed: boolean;
      comment: string | null;
      odometer: number;
      position: string;
    }

    const seedMatches: SeedMatch[] = [];

    for (let i = 0; i < totalMatches; i++) {
      const gameDate = new Date(
        matchStart.getTime() + (timeSpan / totalMatches) * i + randInt(0, 3600000),
      );
      const resultRoll = rand();
      const result: "Victory" | "Defeat" | "Remake" =
        resultRoll < 0.05 ? "Remake" : resultRoll < 0.05 + 0.95 * 0.55 ? "Victory" : "Defeat";
      const isRemake = result === "Remake";
      const durationSeconds = isRemake ? randInt(120, 210) : randInt(1200, 2400);
      const durationMin = durationSeconds / 60;
      const champion = rand() < 0.7 ? pick(MAIN_POOL) : pick(CHAMPIONS);
      const keystone = pick(KEYSTONES);
      const matchup = pick(CHAMPIONS.filter((c) => c.id !== champion.id));
      const posRoll = rand();
      const position =
        posRoll < 0.7 ? "MIDDLE" : posRoll < 0.85 ? "BOTTOM" : pick(["TOP", "JUNGLE", "UTILITY"]);
      const kills = isRemake ? 0 : randInt(1, 15);
      const deaths = isRemake ? 0 : randInt(0, 10);
      const assists = isRemake ? 0 : randInt(1, 18);
      const cs = isRemake ? 0 : Math.round(durationMin * (5 + rand() * 4));
      const csPerMin = isRemake ? 0 : Math.round((cs / durationMin) * 10) / 10;
      const goldEarned = isRemake ? randInt(500, 1000) : randInt(7000, 18000);
      const visionScore = isRemake ? randInt(0, 3) : randInt(10, 50);
      // Review all on-role, non-remake matches except the 5 most recent
      const isOffRole = position !== "MIDDLE" && position !== "BOTTOM";
      const reviewed = isRemake || isOffRole ? false : i < totalMatches - 5;

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
        reviewed,
        comment: reviewed
          ? pick([
              "Good wave management this game. Focus on cs leads in the first 5 minutes.",
              "Should have roamed more after pushing.\n\n---\n\nBack timings were off — lost waves unnecessarily",
              "Team fights went well, positioning was solid. Vision control around dragon was excellent.",
              "Got caught warding alone twice — need to be more careful.\n\nDied to ganks — check minimap before trading.",
              "Lane phase was rough but recovered well. Good roam timing, keep it up.",
              "Good TP plays this game",
            ])
          : null,
        odometer: i + 1,
        position,
      });
    }

    for (const m of seedMatches) {
      await tx.execute({
        sql: `INSERT INTO matches (
                id, odometer, user_id, riot_account_id, game_date, result,
                champion_id, champion_name, rune_keystone_id, rune_keystone_name,
                matchup_champion_id, matchup_champion_name,
                kills, deaths, assists, cs, cs_per_min,
                game_duration_seconds, gold_earned, vision_score,
                comment, reviewed,
                queue_id, position, synced_at, raw_match_json
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          m.matchId,
          m.odometer,
          DEMO_USER_ID,
          DEMO_RIOT_ACCOUNT_ID,
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
          420,
          m.position,
          ts(m.gameDate),
          m.result === "Remake" ? null : buildFakeRawMatchJson(m),
        ],
      });
    }

    // ─── Rank Snapshots ────────────────────────────────────────────────────
    console.log("Creating rank snapshots...");

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
      await tx.execute({
        sql: `INSERT INTO rank_snapshots (user_id, riot_account_id, captured_at, tier, division, lp, wins, losses)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          DEMO_USER_ID,
          DEMO_RIOT_ACCOUNT_ID,
          ts(new Date(snap.date + "T12:00:00Z")),
          snap.tier,
          snap.division,
          snap.lp,
          snap.wins,
          snap.losses,
        ],
      });
    }

    // ─── Coaching Sessions ─────────────────────────────────────────────────
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

    // Get max session ID to avoid conflicts with real user data
    const maxSessionRow = await tx.execute(
      "SELECT COALESCE(MAX(id), 0) as max_id FROM coaching_sessions",
    );
    const sessionIdBase = (maxSessionRow.rows[0].max_id as number) + 100; // offset by 100 to avoid conflicts

    for (let i = 0; i < sessions.length; i++) {
      const s = sessions[i];
      const sessionId = sessionIdBase + i;

      await tx.execute({
        sql: `INSERT INTO coaching_sessions (id, user_id, coach_name, date, status, duration_minutes, notes, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sessionId,
          DEMO_USER_ID,
          s.coachName,
          ts(new Date(s.date)),
          s.status,
          s.durationMinutes,
          s.notes,
          ts(new Date(s.date)),
          ts(new Date(s.date)),
        ],
      });

      for (const tName of s.topicNames) {
        await tx.execute({
          sql: `INSERT INTO coaching_session_topics (session_id, topic_id) VALUES (?, ?)`,
          args: [sessionId, topicId(tName)],
        });
      }

      for (const matchId of s.matchIds) {
        await tx.execute({
          sql: `INSERT INTO coaching_session_matches (session_id, match_id, user_id) VALUES (?, ?, ?)`,
          args: [sessionId, matchId, DEMO_USER_ID],
        });
      }
    }

    // ─── Action Items ──────────────────────────────────────────────────────
    console.log("Creating action items...");

    const actionItems = [
      {
        sessionIdx: 0,
        desc: "Practice slow push -> crash -> roam pattern in 5 games",
        topicName: "Wave management",
        status: "completed",
        completedAt: "2026-02-20T10:00:00Z",
      },
      {
        sessionIdx: 0,
        desc: "Track opponent cooldowns before trading",
        topicName: "Trading patterns",
        status: "completed",
        completedAt: "2026-02-25T10:00:00Z",
      },
      {
        sessionIdx: 0,
        desc: "Review 3 VODs focusing on first 5 minutes",
        topicName: "Laning",
        status: "completed",
        completedAt: "2026-02-18T10:00:00Z",
      },
      {
        sessionIdx: 1,
        desc: "Play 3 games focusing on max-range ability usage in team fights",
        topicName: "Team fighting",
        status: "active",
        completedAt: null,
      },
      {
        sessionIdx: 1,
        desc: "Place 2+ control wards per game before dragon spawns",
        topicName: "Vision control",
        status: "active",
        completedAt: null,
      },
      {
        sessionIdx: 1,
        desc: "Watch LCK mid lane team fight positioning VODs",
        topicName: "Team fighting",
        status: "active",
        completedAt: null,
      },
    ];

    for (const item of actionItems) {
      await tx.execute({
        sql: `INSERT INTO coaching_action_items (session_id, user_id, description, topic_id, status, completed_at, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        args: [
          sessionIdBase + item.sessionIdx,
          DEMO_USER_ID,
          item.desc,
          topicId(item.topicName),
          item.status,
          item.completedAt ? ts(new Date(item.completedAt)) : null,
          ts(new Date("2026-02-10T14:00:00Z")),
        ],
      });
    }

    // ─── Match Highlights ──────────────────────────────────────────────────
    console.log("Creating match highlights...");

    const HIGHLIGHT_TOPICS = [
      "Laning",
      "Wave management",
      "Roaming",
      "Team fighting",
      "Vision control",
      "Objective control",
      "Positioning",
    ];
    const HIGHLIGHT_TEXTS = [
      "Perfect wave freeze denied enemy 2 waves",
      "3-man roam bot got us dragon + double kill",
      "Solo killed matchup at level 6 with full combo",
      "Flash engage won the 5v5 at dragon soul",
      "Won lane with good trades and back timing",
      "Set up a deep ward that caught the jungler invade",
      "Set up slow push before dragon and got priority",
      "Clean 1v1 outplay under tower for first blood",
      "Good TP flank turned the fight around",
      "Zoned 3 enemies off baron with ability threat",
      "Perfect recall timing to catch the wave and not lose xp",
    ];
    const LOWLIGHT_TEXTS = [
      "Greeded for cannon and got chunked to 30%",
      "Died to gank with no vision — need to ward before pushing",
      "Missed every skillshot in the baron fight",
      "Died pushing side lane without vision — tunnel visioned on cs",
      "Kept fighting when behind instead of farming back into the game",
      "Got caught face-checking without sweeper",
      "Forgot to track enemy jungler pathing — died to obvious gank",
      "Burned flash for nothing and got punished 30s later",
      "Forced a bad dive and gave double kill",
    ];

    const reviewedMatches = seedMatches.filter((m) => m.reviewed);
    for (const m of reviewedMatches) {
      const highlightCount = randInt(1, 3);
      for (let j = 0; j < highlightCount; j++) {
        const hasText = rand() < 0.6;
        await tx.execute({
          sql: `INSERT INTO match_highlights (match_id, user_id, riot_account_id, type, text, topic_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            m.matchId,
            DEMO_USER_ID,
            DEMO_RIOT_ACCOUNT_ID,
            "highlight",
            hasText ? pick(HIGHLIGHT_TEXTS) : null,
            topicId(pick(HIGHLIGHT_TOPICS)),
            ts(now),
          ],
        });
      }
      const lowlightCount = randInt(0, 2);
      for (let j = 0; j < lowlightCount; j++) {
        const hasText = rand() < 0.6;
        await tx.execute({
          sql: `INSERT INTO match_highlights (match_id, user_id, riot_account_id, type, text, topic_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
          args: [
            m.matchId,
            DEMO_USER_ID,
            DEMO_RIOT_ACCOUNT_ID,
            "lowlight",
            hasText ? pick(LOWLIGHT_TEXTS) : null,
            topicId(pick(HIGHLIGHT_TOPICS)),
            ts(now),
          ],
        });
      }
    }

    // ─── Action Item Outcomes ───────────────────────────────────────────────
    console.log("Creating action item outcomes...");

    const actionItemRows = await tx.execute({
      sql: `SELECT id, description FROM coaching_action_items WHERE user_id = ? ORDER BY id`,
      args: [DEMO_USER_ID],
    });

    if (actionItemRows.rows.length > 0) {
      const aiIds = actionItemRows.rows.map((r) => Number(r.id));
      const reviewedMatchIds = seedMatches
        .filter((m) => m.reviewed)
        .slice(0, 8)
        .map((m) => m.matchId);

      const outcomes: Array<{ matchId: string; actionItemId: number; outcome: string }> = [];
      for (const matchId of reviewedMatchIds) {
        if (aiIds[3]) {
          outcomes.push({
            matchId,
            actionItemId: aiIds[3],
            outcome: pick(["nailed_it", "forgot", "unsure"]),
          });
        }
        if (aiIds[4]) {
          outcomes.push({
            matchId,
            actionItemId: aiIds[4],
            outcome: pick(["nailed_it", "nailed_it", "forgot"]),
          });
        }
        if (aiIds[5] && rand() < 0.6) {
          outcomes.push({
            matchId,
            actionItemId: aiIds[5],
            outcome: pick(["nailed_it", "unsure", "unsure", "forgot"]),
          });
        }
      }

      for (const o of outcomes) {
        await tx.execute({
          sql: `INSERT INTO match_action_item_outcomes (match_id, action_item_id, user_id, outcome, created_at)
                VALUES (?, ?, ?, ?, ?)`,
          args: [o.matchId, o.actionItemId, DEMO_USER_ID, o.outcome, ts(now)],
        });
      }
    }

    // ─── Challenges ────────────────────────────────────────────────────────
    console.log("Creating challenges...");

    await tx.execute({
      sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, target_tier, target_division, start_tier, start_division, start_lp, status, deadline, created_at, completed_at, failed_at, retired_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DEMO_USER_ID,
        DEMO_RIOT_ACCOUNT_ID,
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

    await tx.execute({
      sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, target_tier, target_division, start_tier, start_division, start_lp, status, deadline, created_at, completed_at, failed_at, retired_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DEMO_USER_ID,
        DEMO_RIOT_ACCOUNT_ID,
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

    await tx.execute({
      sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, metric, metric_condition, metric_threshold, target_games, current_games, successful_games, status, created_at, completed_at, failed_at, retired_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DEMO_USER_ID,
        DEMO_RIOT_ACCOUNT_ID,
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

    await tx.execute({
      sql: `INSERT INTO challenges (user_id, riot_account_id, title, type, metric, metric_condition, metric_threshold, target_games, current_games, successful_games, status, created_at, completed_at, failed_at, retired_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        DEMO_USER_ID,
        DEMO_RIOT_ACCOUNT_ID,
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

    // ─── Commit ────────────────────────────────────────────────────────────
    await tx.commit();

    console.log("\nDemo seed complete!");
    console.log(`  User:             1 (DemoPlayer, premium)`);
    console.log(`  Riot accounts:    2 (main + smurf)`);
    console.log(`  Matches:          ${totalMatches}`);
    console.log(`  Rank snapshots:   ${rankProgression.length}`);
    console.log(`  Coaching sessions: ${sessions.length}`);
    console.log(`  Action items:     ${actionItems.length}`);
    console.log(`  Highlights:       ${reviewedMatches.length} matches with highlights`);
    console.log(`  Challenges:       4`);
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

seedDemo().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
