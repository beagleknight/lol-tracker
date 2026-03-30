// scripts/migrate.ts
// Apply pending Drizzle migrations to the target database.
//
// Reads the journal from drizzle/meta/_journal.json, checks which migrations
// have already been applied (via __drizzle_migrations table), and executes
// any pending ones in order.
//
// Usage:
//   Local:      npx tsx scripts/migrate.ts
//   Vercel:     tsx scripts/migrate.ts   (in buildCommand, env vars are native)
//   With creds: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate.ts
//
// Safe to run repeatedly — idempotent by design.

import { createClient } from "@libsql/client";
import fs from "fs";
import path from "path";

// Strip dotenvx banner if present (only needed when invoked via @dotenvx/dotenvx)
function cleanEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val.replace(/^\[dotenv@[^\]]+\][^\n]*\n/, "");
}

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

async function migrate() {
  const dbUrl = cleanEnv("TURSO_DATABASE_URL") ?? "file:./data/lol-tracker.db";
  const authToken = cleanEnv("TURSO_AUTH_TOKEN");
  const isRemote = dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://");

  console.log(`[migrate] Target: ${dbUrl}`);
  console.log(`[migrate] Remote: ${isRemote}`);

  const client = createClient({ url: dbUrl, authToken });

  // Ensure the migrations tracking table exists
  await client.execute(`
    CREATE TABLE IF NOT EXISTS __drizzle_migrations (
      id integer PRIMARY KEY AUTOINCREMENT,
      hash text NOT NULL,
      created_at numeric
    )
  `);

  // ─── Backfill: detect existing DB that predates this migrate script ───────
  //
  // Migrations 0000–0010 were applied to production/preview via drizzle-kit push
  // BEFORE this migrate script existed. If we detect an existing database with
  // an empty tracking table, we backfill tracking rows so those migrations are
  // never replayed.
  //
  // WHY THIS MATTERS: Migration 0002 contains DROP TABLE + table rebuilds that
  // would destroy columns added by later migrations (0003–0010), causing
  // permanent data loss if replayed.
  //
  // Detection: __drizzle_migrations is empty AND the `users` table already
  // exists. On a truly fresh DB (new Preview env), `users` won't exist yet,
  // so the backfill is skipped and all migrations run normally.
  // ──────────────────────────────────────────────────────────────────────────

  const trackingCount = await client.execute("SELECT count(*) as cnt FROM __drizzle_migrations");
  const hasTrackingRows = Number(trackingCount.rows[0].cnt) > 0;

  if (!hasTrackingRows) {
    const tableCheck = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='users'",
    );
    const isExistingDb = tableCheck.rows.length > 0;

    if (isExistingDb) {
      // These are the exact migration tags from drizzle/meta/_journal.json
      // entries 0–10, all of which were applied before this script existed.
      const preExistingTags = [
        "0000_dusty_khan",
        "0001_worried_guardian",
        "0002_mushy_jackpot",
        "0003_tiresome_hardball",
        "0004_abnormal_alex_wilder",
        "0005_smart_randall_flagg",
        "0006_little_sheva_callister",
        "0007_lively_vampiro",
        "0008_complete_dakota_north",
        "0009_lumpy_dragon_lord",
        "0010_curved_gladiator",
      ];

      console.log(`[migrate] Detected existing database with empty migration tracking.`);
      console.log(`[migrate] Backfilling ${preExistingTags.length} pre-existing migrations...`);

      for (const tag of preExistingTags) {
        await client.execute({
          sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
          args: [tag, Date.now()],
        });
        console.log(`[migrate]   ✓ Backfilled ${tag}`);
      }

      console.log(`[migrate] Backfill complete. Only new migrations will be applied.`);
    }
  }

  // Load the journal
  const journalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");
  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  // Get already-applied migration hashes
  const applied = await client.execute("SELECT hash FROM __drizzle_migrations");
  const appliedHashes = new Set(applied.rows.map((r) => r.hash as string));

  console.log(`[migrate] ${appliedHashes.size} migrations already applied`);
  console.log(`[migrate] ${journal.entries.length} total migrations in journal`);

  let appliedCount = 0;

  for (const entry of journal.entries) {
    const hash = entry.tag;

    if (appliedHashes.has(hash)) {
      continue;
    }

    // Read the SQL file
    const sqlPath = path.resolve(__dirname, `../drizzle/${hash}.sql`);
    if (!fs.existsSync(sqlPath)) {
      console.error(`[migrate] ✗ SQL file not found: ${sqlPath}`);
      process.exit(1);
    }

    const sqlContent = fs.readFileSync(sqlPath, "utf-8");

    // Split by statement breakpoints and execute each statement
    const statements = sqlContent
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    console.log(
      `[migrate] Applying ${hash} (${statements.length} statement${statements.length !== 1 ? "s" : ""})...`,
    );

    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        // For idempotency: skip "already exists" errors
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists") || msg.includes("duplicate column name")) {
          console.log(`[migrate]   ⚠ Skipped (already exists): ${stmt.slice(0, 80)}...`);
          continue;
        }
        console.error(`[migrate] ✗ Failed statement: ${stmt.slice(0, 120)}...`);
        throw err;
      }
    }

    // Record the migration as applied
    await client.execute({
      sql: "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
      args: [hash, Date.now()],
    });

    appliedCount++;
    console.log(`[migrate] ✓ Applied ${hash}`);
  }

  if (appliedCount === 0) {
    console.log("[migrate] All migrations already applied — nothing to do.");
  } else {
    console.log(`[migrate] Done! Applied ${appliedCount} migration(s).`);
  }
}

migrate().catch((err) => {
  console.error("[migrate] Migration failed:", err);
  process.exit(1);
});
