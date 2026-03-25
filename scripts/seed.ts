// scripts/seed.ts
// Deterministic seed data for dev/preview environments.
// Run: npm run db:seed
//
// Creates 2 users, ~50 matches, rank snapshots, coaching sessions,
// action items, highlights, and an invite. Uses a simple seeded PRNG
// for reproducibility (same seed = same data every time).

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

const SUPPORT_CHAMPIONS = [
  { id: 412, name: "Thresh" },
  { id: 12, name: "Alistar" },
  { id: 89, name: "Leona" },
  { id: 53, name: "Blitzcrank" },
  { id: 117, name: "Lulu" },
  { id: 267, name: "Nami" },
] as const;

const _TOPICS = [
  "Laning",
  "Wave management",
  "Roaming",
  "Team fighting",
  "Vision control",
  "CS improvement",
  "Trading patterns",
  "Back timing",
  "Objective control",
  "Matchup knowledge",
] as const;

// ─── Fixed IDs ───────────────────────────────────────────────────────────────

const MAIN_USER_ID = "demo-user-0001-0001-000000000001";
const DUO_USER_ID = "demo-user-0002-0002-000000000002";

const MAIN_USER = {
  id: MAIN_USER_ID,
  discordId: "demo_discord_001",
  name: "DemoPlayer",
  image: null,
  email: "demo@example.com",
  riotGameName: "DemoPlayer",
  riotTagLine: "EUW",
  puuid: "demo-puuid-main-0000000000000000000000000000000000000000",
  summonerId: "demo-summoner-main",
  duoPartnerUserId: DUO_USER_ID,
  locale: "en-GB",
  language: "en",
  role: "admin" as const,
};

const DUO_USER = {
  id: DUO_USER_ID,
  discordId: "demo_discord_002",
  name: "DuoPartner",
  image: null,
  email: "duo@example.com",
  riotGameName: "DuoPartner",
  riotTagLine: "EUW",
  puuid: "demo-puuid-duo-00000000000000000000000000000000000000000",
  summonerId: "demo-summoner-duo",
  duoPartnerUserId: MAIN_USER_ID,
  locale: "en-GB",
  language: "en",
  role: "user" as const,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// ─── Seed Script ─────────────────────────────────────────────────────────────

async function seed() {
  const dbUrl = process.env.TURSO_DATABASE_URL ?? "file:./data/lol-tracker.db";
  const dbToken = process.env.TURSO_AUTH_TOKEN;

  console.log(`Seeding database: ${dbUrl}`);

  const client = createClient({ url: dbUrl, authToken: dbToken });

  // Ensure tables exist (CREATE IF NOT EXISTS).
  // This makes the seed script self-contained — no need to run
  // drizzle-kit push separately for local dev.
  console.log("Ensuring tables exist...");
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL UNIQUE,
      name TEXT,
      image TEXT,
      email TEXT,
      riot_game_name TEXT,
      riot_tag_line TEXT,
      puuid TEXT,
      summoner_id TEXT,
      duo_partner_user_id TEXT,
      locale TEXT DEFAULT 'en-GB',
      language TEXT DEFAULT 'en',
      role TEXT NOT NULL DEFAULT 'user',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT NOT NULL,
      odometer INTEGER NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      game_date INTEGER NOT NULL,
      result TEXT NOT NULL,
      champion_id INTEGER NOT NULL,
      champion_name TEXT NOT NULL,
      rune_keystone_id INTEGER,
      rune_keystone_name TEXT,
      matchup_champion_id INTEGER,
      matchup_champion_name TEXT,
      kills INTEGER NOT NULL DEFAULT 0,
      deaths INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      cs INTEGER NOT NULL DEFAULT 0,
      cs_per_min REAL DEFAULT 0,
      game_duration_seconds INTEGER NOT NULL DEFAULT 0,
      gold_earned INTEGER DEFAULT 0,
      vision_score INTEGER DEFAULT 0,
      comment TEXT,
      reviewed INTEGER NOT NULL DEFAULT 0,
      review_notes TEXT,
      review_skipped_reason TEXT,
      vod_url TEXT,
      queue_id INTEGER,
      synced_at INTEGER NOT NULL,
      raw_match_json TEXT,
      duo_partner_puuid TEXT,
      duo_partner_champion_name TEXT,
      duo_partner_kills INTEGER,
      duo_partner_deaths INTEGER,
      duo_partner_assists INTEGER,
      PRIMARY KEY (id, user_id)
    );
    CREATE TABLE IF NOT EXISTS rank_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      captured_at INTEGER NOT NULL,
      tier TEXT,
      division TEXT,
      lp INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS coaching_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      coach_name TEXT NOT NULL,
      date INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      vod_match_id TEXT,
      duration_minutes INTEGER,
      topics TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coaching_session_matches (
      session_id INTEGER NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
      match_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (session_id, match_id)
    );
    CREATE TABLE IF NOT EXISTS coaching_action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES coaching_sessions(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      topic TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      completed_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      used_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS match_highlights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      text TEXT NOT NULL,
      topic TEXT,
      created_at INTEGER NOT NULL
    );
  `);

  // Clear existing data (order matters for foreign keys)
  console.log("Clearing existing data...");
  await client.executeMultiple(`
    DELETE FROM match_highlights;
    DELETE FROM coaching_action_items;
    DELETE FROM coaching_session_matches;
    DELETE FROM coaching_sessions;
    DELETE FROM rank_snapshots;
    DELETE FROM matches;
    DELETE FROM invites;
    DELETE FROM users;
  `);

  // ─── Users ───────────────────────────────────────────────────────────────
  console.log("Creating users...");
  const now = new Date("2026-03-25T10:00:00Z");

  for (const u of [MAIN_USER, DUO_USER]) {
    await client.execute({
      sql: `INSERT INTO users (id, discord_id, name, image, email, riot_game_name, riot_tag_line, puuid, summoner_id, duo_partner_user_id, locale, language, role, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        u.id, u.discordId, u.name, u.image, u.email,
        u.riotGameName, u.riotTagLine, u.puuid, u.summonerId,
        u.duoPartnerUserId, u.locale, u.language, u.role,
        ts(now), ts(now),
      ],
    });
  }

  // ─── Invite ──────────────────────────────────────────────────────────────
  console.log("Creating invite...");
  await client.execute({
    sql: `INSERT INTO invites (code, created_by, used_by, used_at, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: ["DEMO-INVITE-001", MAIN_USER_ID, DUO_USER_ID, ts(now), ts(now)],
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
    result: "Victory" | "Defeat";
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
  }

  const seedMatches: SeedMatch[] = [];

  for (let i = 0; i < totalMatches; i++) {
    const gameDate = new Date(
      matchStart.getTime() + (timeSpan / totalMatches) * i + randInt(0, 3600000)
    );
    const durationSeconds = randInt(1200, 2400); // 20–40 min
    const durationMin = durationSeconds / 60;

    // Main user plays from their pool 70% of the time
    const champion = rand() < 0.7 ? pick(MAIN_POOL) : pick(CHAMPIONS);
    const keystone = pick(KEYSTONES);
    const matchup = pick(CHAMPIONS.filter((c) => c.id !== champion.id));

    // ~55% win rate (slightly positive, climbing)
    const result: "Victory" | "Defeat" = rand() < 0.55 ? "Victory" : "Defeat";

    const kills = randInt(1, 15);
    const deaths = randInt(0, 10);
    const assists = randInt(1, 18);
    const cs = Math.round(durationMin * (5 + rand() * 4)); // 5–9 cs/min
    const csPerMin = Math.round((cs / durationMin) * 10) / 10;
    const goldEarned = randInt(7000, 18000);
    const visionScore = randInt(10, 50);

    // Duo partner appears in ~40% of matches
    const hasDuo = rand() < 0.4;
    const duoChampion = hasDuo ? pick(SUPPORT_CHAMPIONS) : null;

    // ~30% reviewed, ~10% skipped, rest unreviewed
    const reviewRoll = rand();
    const reviewed = reviewRoll < 0.3;
    const skipped = reviewRoll >= 0.3 && reviewRoll < 0.4;

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
      comment: reviewed && rand() < 0.6
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
    });
  }

  for (const m of seedMatches) {
    await client.execute({
      sql: `INSERT INTO matches (
              id, odometer, user_id, game_date, result,
              champion_id, champion_name, rune_keystone_id, rune_keystone_name,
              matchup_champion_id, matchup_champion_name,
              kills, deaths, assists, cs, cs_per_min,
              game_duration_seconds, gold_earned, vision_score,
              comment, reviewed, review_notes, review_skipped_reason,
              queue_id, synced_at, raw_match_json,
              duo_partner_puuid, duo_partner_champion_name,
              duo_partner_kills, duo_partner_deaths, duo_partner_assists
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        m.matchId, m.odometer, MAIN_USER_ID, ts(m.gameDate), m.result,
        m.champion.id, m.champion.name, m.keystone.id, m.keystone.name,
        m.matchup.id, m.matchup.name,
        m.kills, m.deaths, m.assists, m.cs, m.csPerMin,
        m.durationSeconds, m.goldEarned, m.visionScore,
        m.comment, m.reviewed ? 1 : 0, m.reviewNotes, m.reviewSkipped,
        420, ts(m.gameDate), null,
        m.hasDuo ? DUO_USER.puuid : null,
        m.duoChampion?.name ?? null,
        m.hasDuo ? m.duoKills : null,
        m.hasDuo ? m.duoDeaths : null,
        m.hasDuo ? m.duoAssists : null,
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
      sql: `INSERT INTO rank_snapshots (user_id, captured_at, tier, division, lp, wins, losses)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        MAIN_USER_ID,
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
      topics: JSON.stringify(["Laning", "Wave management", "Trading patterns"]),
      notes: "Focused on early lane control. Key takeaway: slow push into roam timing.",
      matchIds: ["EUW1_7000000010", "EUW1_7000000012"],
    },
    {
      coachName: "CoachKim",
      date: "2026-03-05T15:00:00Z",
      status: "completed",
      durationMinutes: 45,
      topics: JSON.stringify(["Team fighting", "Vision control"]),
      notes: "Reviewed team fight positioning. Need to stay further back and use abilities from max range.",
      matchIds: ["EUW1_7000000030", "EUW1_7000000032", "EUW1_7000000035"],
    },
    {
      coachName: "CoachKim",
      date: "2026-03-28T16:00:00Z",
      status: "scheduled",
      durationMinutes: null,
      topics: JSON.stringify(["Roaming", "Objective control"]),
      notes: null,
      matchIds: [],
    },
  ];

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    const sessionId = i + 1;

    await client.execute({
      sql: `INSERT INTO coaching_sessions (id, user_id, coach_name, date, status, duration_minutes, topics, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        sessionId, MAIN_USER_ID, s.coachName,
        ts(new Date(s.date)), s.status,
        s.durationMinutes, s.topics, s.notes,
        ts(new Date(s.date)), ts(new Date(s.date)),
      ],
    });

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
    { sessionId: 1, desc: "Practice slow push -> crash -> roam pattern in 5 games", topic: "Wave management", status: "completed", completedAt: "2026-02-20T10:00:00Z" },
    { sessionId: 1, desc: "Track opponent cooldowns before trading", topic: "Trading patterns", status: "completed", completedAt: "2026-02-25T10:00:00Z" },
    { sessionId: 1, desc: "Review 3 VODs focusing on first 5 minutes", topic: "Laning", status: "completed", completedAt: "2026-02-18T10:00:00Z" },
    // Session 2 items
    { sessionId: 2, desc: "Play 3 games focusing on max-range ability usage in team fights", topic: "Team fighting", status: "in_progress", completedAt: null },
    { sessionId: 2, desc: "Place 2+ control wards per game before dragon spawns", topic: "Vision control", status: "in_progress", completedAt: null },
    { sessionId: 2, desc: "Watch LCK mid lane team fight positioning VODs", topic: "Team fighting", status: "pending", completedAt: null },
  ];

  for (const item of actionItems) {
    await client.execute({
      sql: `INSERT INTO coaching_action_items (session_id, user_id, description, topic, status, completed_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        item.sessionId, MAIN_USER_ID, item.desc, item.topic, item.status,
        item.completedAt ? ts(new Date(item.completedAt)) : null,
        ts(new Date("2026-02-10T14:00:00Z")),
      ],
    });
  }

  // ─── Match Highlights ────────────────────────────────────────────────────
  console.log("Creating match highlights...");

  const highlights = [
    { matchId: "EUW1_7000000005", type: "highlight", text: "Perfect wave freeze denied enemy 2 waves", topic: "Wave management" },
    { matchId: "EUW1_7000000005", type: "lowlight", text: "Greeded for cannon and got chunked to 30%", topic: "Laning" },
    { matchId: "EUW1_7000000010", type: "highlight", text: "3-man roam bot got us dragon + double kill", topic: "Roaming" },
    { matchId: "EUW1_7000000015", type: "lowlight", text: "Died to gank with no vision — need to ward before pushing", topic: "Vision control" },
    { matchId: "EUW1_7000000015", type: "highlight", text: "Solo killed matchup at level 6 with full combo", topic: "Laning" },
    { matchId: "EUW1_7000000020", type: "highlight", text: "Team fight positioning was great — stayed max range entire fight", topic: "Team fighting" },
    { matchId: "EUW1_7000000020", type: "lowlight", text: "Used flash aggressively when it wasn't needed", topic: "Team fighting" },
    { matchId: "EUW1_7000000025", type: "highlight", text: "Won lane with good trades and back timing", topic: "Laning" },
    { matchId: "EUW1_7000000030", type: "lowlight", text: "Walked into unwarded jungle and got collapsed on", topic: "Vision control" },
    { matchId: "EUW1_7000000035", type: "highlight", text: "Set up slow push before dragon and got priority", topic: "Wave management" },
    { matchId: "EUW1_7000000040", type: "lowlight", text: "Missed every skillshot in the baron fight", topic: "Team fighting" },
    { matchId: "EUW1_7000000045", type: "highlight", text: "Clean 1v1 outplay under tower for first blood", topic: "Laning" },
  ];

  for (const h of highlights) {
    await client.execute({
      sql: `INSERT INTO match_highlights (match_id, user_id, type, text, topic, created_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [h.matchId, MAIN_USER_ID, h.type, h.text, h.topic, ts(now)],
    });
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log("\nSeed complete!");
  console.log(`  Users:            2`);
  console.log(`  Matches:          ${totalMatches}`);
  console.log(`  Rank snapshots:   ${rankProgression.length}`);
  console.log(`  Coaching sessions: ${sessions.length}`);
  console.log(`  Action items:     ${actionItems.length}`);
  console.log(`  Highlights:       ${highlights.length}`);
  console.log(`  Invites:          1`);
  console.log(`\nDemo user login:`);
  console.log(`  Name: ${MAIN_USER.name}`);
  console.log(`  Riot ID: ${MAIN_USER.riotGameName}#${MAIN_USER.riotTagLine}`);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
