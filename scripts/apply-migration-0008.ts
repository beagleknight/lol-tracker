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
  console.log("Adding 'status' column to coaching_sessions...");
  await db.execute(
    "ALTER TABLE `coaching_sessions` ADD `status` text DEFAULT 'scheduled' NOT NULL"
  );

  console.log("Adding 'vod_match_id' column to coaching_sessions...");
  await db.execute(
    "ALTER TABLE `coaching_sessions` ADD `vod_match_id` text"
  );

  console.log("Creating index coaching_sessions_user_status_idx...");
  await db.execute(
    "CREATE INDEX `coaching_sessions_user_status_idx` ON `coaching_sessions` (`user_id`,`status`)"
  );

  // Verify
  const cols = await db.execute("PRAGMA table_info(coaching_sessions)");
  console.log(
    "coaching_sessions columns:",
    cols.rows.map((r) => r.name)
  );

  console.log("Done!");
}

run().catch(console.error);
