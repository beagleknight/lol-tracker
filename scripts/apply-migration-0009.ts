// scripts/apply-migration-0009.ts
// Add `locale` column to users table
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
  await db.execute("ALTER TABLE `users` ADD `locale` text DEFAULT 'en-GB'");
  console.log("Migration 0009 applied: added locale column to users table");
}
run().catch(console.error);
