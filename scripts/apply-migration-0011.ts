// scripts/apply-migration-0011.ts
// Create `goals` table with index
// Run: npx @dotenvx/dotenvx run --env-file=.env.tmp -- npx tsx scripts/apply-migration-0011.ts

import { createClient } from "@libsql/client";

function cleanEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val.replace(/^\[dotenv@[^\]]+\][^\n]*\n/, "");
}

const db = createClient({
  url: cleanEnv("TURSO_DATABASE_URL")!,
  authToken: cleanEnv("TURSO_AUTH_TOKEN"),
});

async function run() {
  console.log("Applying migration 0011: create goals table...");
  console.log(`Target DB: ${cleanEnv("TURSO_DATABASE_URL")}`);

  await db.execute(`CREATE TABLE IF NOT EXISTS \`goals\` (
    \`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    \`user_id\` text NOT NULL,
    \`title\` text NOT NULL,
    \`target_tier\` text NOT NULL,
    \`target_division\` text,
    \`start_tier\` text NOT NULL,
    \`start_division\` text,
    \`start_lp\` integer DEFAULT 0 NOT NULL,
    \`status\` text DEFAULT 'active' NOT NULL,
    \`deadline\` integer,
    \`created_at\` integer NOT NULL,
    \`achieved_at\` integer,
    \`retired_at\` integer,
    FOREIGN KEY (\`user_id\`) REFERENCES \`users\`(\`id\`) ON UPDATE no action ON DELETE cascade
  )`);

  await db.execute(
    "CREATE INDEX IF NOT EXISTS `goals_user_status_idx` ON `goals` (`user_id`, `status`)"
  );

  console.log("Done! Verifying...");

  const result = await db.execute("PRAGMA table_info(goals)");
  const cols = result.rows.map((r) => r.name);
  console.log("Columns:", cols.join(", "));

  if (cols.includes("id") && cols.includes("user_id") && cols.includes("status")) {
    console.log("✓ goals table created successfully");
  } else {
    console.error("✗ goals table verification failed!");
    process.exit(1);
  }
}

run().catch(console.error);
