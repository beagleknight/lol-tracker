// scripts/apply-migration-0010.ts
// Add `language` column to users table (default 'en')
// Run: npx @dotenvx/dotenvx run --env-file=.env.local -- npx tsx scripts/apply-migration-0010.ts

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
  console.log("Applying migration 0010: add language column to users...");
  await db.execute("ALTER TABLE `users` ADD `language` text DEFAULT 'en'");
  console.log("Done! Verifying...");

  const result = await db.execute("PRAGMA table_info(users)");
  const cols = result.rows.map((r) => r.name);
  if (cols.includes("language")) {
    console.log("✓ language column exists in users table");
  } else {
    console.error("✗ language column NOT found!");
    process.exit(1);
  }
}

run().catch(console.error);
