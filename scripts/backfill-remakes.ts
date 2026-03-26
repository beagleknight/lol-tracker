/**
 * backfill-remakes — Parse rawMatchJson for all existing matches and update
 * result to "Remake" where gameEndedInEarlySurrender is true or
 * gameDuration < 300 seconds.
 *
 * Usage:
 *   npx tsx scripts/backfill-remakes.ts                     (local DB)
 *   TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/backfill-remakes.ts  (production)
 */

import { createClient } from "@libsql/client";

// Strip dotenvx banner from env vars
function cleanEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val.replace(/^\[dotenv@[^\]]+\][^\n]*\n/, "");
}

const TURSO_URL = cleanEnv("TURSO_DATABASE_URL");
const TURSO_TOKEN = cleanEnv("TURSO_AUTH_TOKEN");

const isProduction = !!TURSO_URL && !TURSO_URL.startsWith("file:");

if (isProduction && !process.argv.includes("--force-remote")) {
  console.error(
    "ERROR: This script would run against a REMOTE database.\n" +
      "Pass --force-remote to confirm."
  );
  process.exit(1);
}

const db = createClient({
  url: TURSO_URL ?? "file:./data/lol-tracker.db",
  authToken: TURSO_TOKEN,
});

async function main() {
  console.log(
    `Running against ${isProduction ? "PRODUCTION" : "LOCAL"} database\n`
  );

  // Get all matches that have raw JSON and are currently Victory/Defeat
  const matchesResult = await db.execute(
    "SELECT id, user_id, result, raw_match_json FROM matches WHERE raw_match_json IS NOT NULL AND result IN ('Victory', 'Defeat')"
  );

  console.log(
    `Found ${matchesResult.rows.length} matches with raw JSON to check\n`
  );

  let checked = 0;
  let remakesFound = 0;

  for (const row of matchesResult.rows) {
    const matchId = row.id as string;
    const userId = row.user_id as string;
    const rawJson = row.raw_match_json as string;

    try {
      const matchData = JSON.parse(rawJson);
      const info = matchData?.info;
      if (!info) continue;

      const isRemake =
        info.gameEndedInEarlySurrender === true || info.gameDuration < 300;

      if (isRemake) {
        await db.execute({
          sql: "UPDATE matches SET result = 'Remake' WHERE id = ? AND user_id = ?",
          args: [matchId, userId],
        });
        remakesFound++;
        console.log(`  Updated ${matchId} -> Remake (duration: ${info.gameDuration}s, earlySurrender: ${info.gameEndedInEarlySurrender})`);
      }

      checked++;
    } catch {
      console.log(`  Warning: failed to parse match ${matchId}`);
    }
  }

  console.log(
    `\nChecked ${checked} matches, found ${remakesFound} remakes.\n`
  );
  console.log("Backfill complete!");
}

main().catch(console.error);
