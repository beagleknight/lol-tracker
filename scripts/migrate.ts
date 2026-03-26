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

  // Load the journal
  const journalPath = path.resolve(__dirname, "../drizzle/meta/_journal.json");
  const journal: Journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  // Get already-applied migration hashes
  const applied = await client.execute("SELECT hash FROM __drizzle_migrations");
  const appliedHashes = new Set(applied.rows.map((r) => String(r.hash)));

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
      `[migrate] Applying ${hash} (${statements.length} statement${statements.length !== 1 ? "s" : ""})...`
    );

    for (const stmt of statements) {
      try {
        await client.execute(stmt);
      } catch (err) {
        // For idempotency: skip "already exists" errors
        const msg = err instanceof Error ? err.message : String(err);
        if (
          msg.includes("already exists") ||
          msg.includes("duplicate column name")
        ) {
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
