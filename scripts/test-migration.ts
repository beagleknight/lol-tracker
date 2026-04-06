// scripts/test-migration.ts
// Migration integration test — verifies that migrations correctly handle
// pre-existing data, not just empty databases.
//
// This catches bugs like migration 0022 (created riot_accounts table but
// never migrated existing user data into it). The seed script masks such
// gaps because it creates the "ideal end state" directly.
//
// How it works:
// 1. Creates a fresh in-memory SQLite database
// 2. Applies migrations 0000–0021 (the "before multi-account" schema)
// 3. Inserts fixture data that matches a real production user
// 4. Applies remaining migrations (0022+)
// 5. Runs validation queries to verify data integrity
//
// Usage:
//   npx tsx scripts/test-migration.ts
//
// Exit code 0 = all validations passed, 1 = failure.

import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

interface JournalEntry {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
}

interface Journal {
  version: string;
  dialect: string;
  entries: JournalEntry[];
}

// The migration index where multi-account support was introduced.
// We apply 0000–(SPLIT_POINT-1) first, insert fixtures, then apply the rest.
const SPLIT_POINT = 22; // 0022_odd_maggott.sql = CREATE TABLE riot_accounts

async function applyMigrations(
  client: ReturnType<typeof createClient>,
  entries: JournalEntry[],
  label: string,
) {
  for (const entry of entries) {
    const sqlPath = path.resolve(__dirname, `../drizzle/${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found: ${sqlPath}`);
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf-8");
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Skip "already exists" for idempotency (matches migrate.ts behavior)
        if (msg.includes("already exists") || msg.includes("duplicate column name")) {
          continue;
        }
        throw new Error(
          `Failed in ${label}, migration ${entry.tag}: ${msg}\n  Statement: ${stmt.slice(0, 200)}`,
        );
      }
    }
  }
}

async function insertPreMigrationFixtures(client: ReturnType<typeof createClient>) {
  // Simulate a production user who linked their Riot account before multi-account migration.
  // This user has data in: users, matches, rank_snapshots, goals, match_highlights, ai_insights.
  const userId = "test-user-001";
  const puuid = "test-puuid-abc123";
  const now = Math.floor(Date.now() / 1000);

  // User with Riot data in the old schema (stored directly on users table)
  await client.execute({
    sql: `INSERT INTO users (id, discord_id, name, image, puuid, riot_game_name, riot_tag_line,
          summoner_id, region, onboarding_completed, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      userId,
      "discord-12345",
      "TestPlayer",
      "https://example.com/avatar.png",
      puuid,
      "TestPlayer",
      "EUW",
      "summoner-id-001",
      "euw1",
      1,
      "user",
      now,
      now,
    ],
  });

  // A second user WITHOUT Riot data (should not crash migrations)
  await client.execute({
    sql: `INSERT INTO users (id, discord_id, name, onboarding_completed, role, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: ["test-user-002", "discord-67890", "NoRiotUser", 0, "user", now, now],
  });

  // Matches for the linked user
  for (let i = 0; i < 3; i++) {
    await client.execute({
      sql: `INSERT INTO matches (id, odometer, user_id, game_date, result, champion_id, champion_name,
            kills, deaths, assists, cs, game_duration_seconds, synced_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        `EUW1_TEST_${i}`,
        i + 1,
        userId,
        now - i * 3600,
        i % 2 === 0 ? "Victory" : "Defeat",
        1,
        "Ahri",
        5 + i,
        3,
        7,
        180,
        1800,
        now,
      ],
    });
  }

  // Rank snapshot
  await client.execute({
    sql: `INSERT INTO rank_snapshots (user_id, captured_at, tier, division, lp, wins, losses)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, now, "GOLD", "II", 45, 30, 25],
  });

  // Goal
  await client.execute({
    sql: `INSERT INTO goals (user_id, title, target_tier, target_division, start_tier, start_division, start_lp, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [userId, "Reach Platinum", "PLATINUM", "IV", "GOLD", "II", 45, "active", now],
  });

  // Match highlight
  await client.execute({
    sql: `INSERT INTO match_highlights (match_id, user_id, type, text, created_at)
          VALUES (?, ?, ?, ?, ?)`,
    args: ["EUW1_TEST_0", userId, "highlight", "Great roam at 12 min", now],
  });

  // AI insight
  await client.execute({
    sql: `INSERT INTO ai_insights (user_id, type, context_key, content, model, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [userId, "matchup", "ahri-vs-zed", "Focus on wave management", "gemini-2.5-flash", now],
  });
}

interface Validation {
  name: string;
  query: string;
  check: (rows: Array<Record<string, unknown>>) => string | null; // null = pass, string = error
}

function buildValidations(): Validation[] {
  return [
    {
      name: "Every user with puuid has a riot_accounts row",
      query: `
        SELECT u.id, u.puuid
        FROM users u
        WHERE u.puuid IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM riot_accounts ra WHERE ra.user_id = u.id
          )
      `,
      check: (rows) =>
        rows.length > 0
          ? `${rows.length} user(s) with puuid but no riot_accounts row: ${rows.map((r) => r.id).join(", ")}`
          : null,
    },
    {
      name: "Every user with puuid has active_riot_account_id set",
      query: `
        SELECT id FROM users
        WHERE puuid IS NOT NULL AND active_riot_account_id IS NULL
      `,
      check: (rows) =>
        rows.length > 0
          ? `${rows.length} user(s) with puuid but NULL active_riot_account_id: ${rows.map((r) => r.id).join(", ")}`
          : null,
    },
    {
      name: "Every match for a user with riot_accounts has riot_account_id set",
      query: `
        SELECT m.id, m.user_id
        FROM matches m
        JOIN users u ON u.id = m.user_id
        WHERE u.puuid IS NOT NULL AND m.riot_account_id IS NULL
      `,
      check: (rows) =>
        rows.length > 0
          ? `${rows.length} match(es) with NULL riot_account_id: ${rows.map((r) => r.id).join(", ")}`
          : null,
    },
    {
      name: "Every rank_snapshot for a user with riot_accounts has riot_account_id set",
      query: `
        SELECT rs.id, rs.user_id
        FROM rank_snapshots rs
        JOIN users u ON u.id = rs.user_id
        WHERE u.puuid IS NOT NULL AND rs.riot_account_id IS NULL
      `,
      check: (rows) =>
        rows.length > 0 ? `${rows.length} rank_snapshot(s) with NULL riot_account_id` : null,
    },
    {
      name: "Every goal for a user with riot_accounts has riot_account_id set",
      query: `
        SELECT g.id, g.user_id
        FROM goals g
        JOIN users u ON u.id = g.user_id
        WHERE u.puuid IS NOT NULL AND g.riot_account_id IS NULL
      `,
      check: (rows) =>
        rows.length > 0 ? `${rows.length} goal(s) with NULL riot_account_id` : null,
    },
    {
      name: "Every match_highlight for a user with riot_accounts has riot_account_id set",
      query: `
        SELECT mh.id, mh.user_id
        FROM match_highlights mh
        JOIN users u ON u.id = mh.user_id
        WHERE u.puuid IS NOT NULL AND mh.riot_account_id IS NULL
      `,
      check: (rows) =>
        rows.length > 0 ? `${rows.length} match_highlight(s) with NULL riot_account_id` : null,
    },
    {
      name: "Every ai_insight for a user with riot_accounts has riot_account_id set",
      query: `
        SELECT ai.id, ai.user_id
        FROM ai_insights ai
        JOIN users u ON u.id = ai.user_id
        WHERE u.puuid IS NOT NULL AND ai.riot_account_id IS NULL
      `,
      check: (rows) =>
        rows.length > 0 ? `${rows.length} ai_insight(s) with NULL riot_account_id` : null,
    },
    {
      name: "Users without Riot data have no riot_accounts rows",
      query: `
        SELECT ra.id, ra.user_id
        FROM riot_accounts ra
        JOIN users u ON u.id = ra.user_id
        WHERE u.puuid IS NULL
      `,
      check: (rows) =>
        rows.length > 0
          ? `${rows.length} orphaned riot_accounts row(s) for users without puuid`
          : null,
    },
    {
      name: "riot_accounts.is_primary is set for migrated accounts",
      query: `
        SELECT ra.id FROM riot_accounts ra
        WHERE ra.is_primary = 0
          AND (SELECT COUNT(*) FROM riot_accounts ra2 WHERE ra2.user_id = ra.user_id AND ra2.is_primary = 1) = 0
      `,
      check: (rows) =>
        rows.length > 0
          ? `${rows.length} riot_accounts without any primary account for their user`
          : null,
    },
  ];
}

async function main() {
  console.log("[test-migration] Starting migration integration test...\n");

  // Use in-memory SQLite for speed and isolation
  const client = createClient({ url: ":memory:" });

  // Load journal
  const journalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");
  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  const beforeEntries = journal.entries.filter((e) => e.idx < SPLIT_POINT);
  const afterEntries = journal.entries.filter((e) => e.idx >= SPLIT_POINT);

  console.log(
    `[test-migration] Phase 1: Applying migrations 0000–${String(SPLIT_POINT - 1).padStart(4, "0")} (${beforeEntries.length} migrations)...`,
  );
  await applyMigrations(client, beforeEntries, "phase-1");
  console.log("[test-migration] Phase 1 complete.\n");

  console.log("[test-migration] Phase 2: Inserting pre-migration fixture data...");
  await insertPreMigrationFixtures(client);
  console.log(
    "[test-migration] Phase 2 complete. Inserted: 2 users, 3 matches, 1 rank snapshot, 1 goal, 1 highlight, 1 AI insight.\n",
  );

  console.log(
    `[test-migration] Phase 3: Applying migrations ${String(SPLIT_POINT).padStart(4, "0")}–${String(journal.entries.length - 1).padStart(4, "0")} (${afterEntries.length} migrations)...`,
  );
  await applyMigrations(client, afterEntries, "phase-3");
  console.log("[test-migration] Phase 3 complete.\n");

  console.log("[test-migration] Phase 4: Running validation queries...\n");
  const validations = buildValidations();
  let passed = 0;
  let failed = 0;

  for (const v of validations) {
    const result = await client.execute(v.query);
    const rows = result.rows as unknown as Array<Record<string, unknown>>;
    const error = v.check(rows);
    if (error) {
      console.error(`  ✗ ${v.name}`);
      console.error(`    → ${error}`);
      failed++;
    } else {
      console.log(`  ✓ ${v.name}`);
      passed++;
    }
  }

  console.log(
    `\n[test-migration] Results: ${passed} passed, ${failed} failed out of ${validations.length} validations.`,
  );

  if (failed > 0) {
    console.error(
      "\n[test-migration] FAILED — migrations do not correctly handle pre-existing data.",
    );
    process.exit(1);
  }

  console.log("\n[test-migration] PASSED — all migrations correctly migrate pre-existing data.");
}

main().catch((err) => {
  console.error("[test-migration] Unexpected error:", err);
  process.exit(1);
});
