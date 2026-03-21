/**
 * Apply migration 0004 directly to production Turso.
 * Usage: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/migrate-prod.ts
 * Or:    npx tsx --env-file-if-exists=.env.local scripts/migrate-prod.ts
 */
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url || !token) {
    console.error("TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set");
    process.exit(1);
  }

  console.log("Connecting to Turso:", url);
  const db = createClient({ url, authToken: token });

  // Check current matches columns
  const cols = await db.execute("PRAGMA table_info(matches)");
  const colNames = cols.rows.map((r) => r.name as string);
  console.log("Current matches columns:", colNames.join(", "));

  if (!colNames.includes("review_skipped_reason")) {
    console.log("Adding review_skipped_reason...");
    await db.execute("ALTER TABLE matches ADD review_skipped_reason text");
    console.log("  Done.");
  } else {
    console.log("review_skipped_reason already exists, skipping.");
  }

  if (!colNames.includes("vod_url")) {
    console.log("Adding vod_url...");
    await db.execute("ALTER TABLE matches ADD vod_url text");
    console.log("  Done.");
  } else {
    console.log("vod_url already exists, skipping.");
  }

  // Check if match_highlights table exists
  const tables = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='match_highlights'"
  );
  if (tables.rows.length === 0) {
    console.log("Creating match_highlights table...");
    await db.execute(`CREATE TABLE match_highlights (
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      match_id text NOT NULL,
      user_id text NOT NULL,
      type text NOT NULL,
      text text NOT NULL,
      topic text,
      created_at integer NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
    )`);
    await db.execute(
      "CREATE INDEX match_highlights_match_user_idx ON match_highlights (match_id, user_id)"
    );
    console.log("  Done.");
  } else {
    console.log("match_highlights table already exists, skipping.");
  }

  db.close();
  console.log("\nMigration complete!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
