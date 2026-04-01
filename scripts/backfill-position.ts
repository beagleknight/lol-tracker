/**
 * backfill-position — Populate the `position` column for existing matches
 * by reading the raw_match_json and extracting teamPosition / individualPosition.
 *
 * Usage:
 *   npx tsx scripts/backfill-position.ts                     (local DB)
 *   npx @dotenvx/dotenvx run --env-file=.env.local -- npx tsx scripts/backfill-position.ts  (production)
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

const db = createClient({
  url: TURSO_URL ?? "file:./data/lol-tracker.db",
  authToken: TURSO_TOKEN,
});

async function main() {
  console.log(`Running against ${isProduction ? "PRODUCTION" : "LOCAL"} database\n`);

  // Get all matches missing the position column that have raw JSON
  const result = await db.execute(
    `SELECT id, user_id, raw_match_json
     FROM matches
     WHERE position IS NULL
       AND raw_match_json IS NOT NULL`,
  );

  console.log(`Found ${result.rows.length} matches needing position backfill\n`);

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const matchId = row.id as string;
    const userId = row.user_id as string;
    const rawJson = row.raw_match_json as string;

    try {
      const matchData = JSON.parse(rawJson);
      const participants = matchData?.info?.participants;
      if (!Array.isArray(participants)) {
        skipped++;
        continue;
      }

      // Find the user's participant data — match by puuid stored in the user record
      // Since we don't have the puuid here, look for the participant whose puuid
      // was used to create this match. We can find it from the metadata.
      const _userPuuid = matchData?.metadata?.participants?.find((puuid: string) => {
        // The user's puuid should correspond to a participant in the match
        return participants.some((p: { puuid: string }) => p.puuid === puuid);
      });

      // Alternative approach: we know the match belongs to this user, so
      // look up by checking which participant's puuid we stored when syncing.
      // Since we don't have the user's puuid in this query, we use a simpler
      // approach: query it from the users table.
      const userResult = await db.execute({
        sql: `SELECT puuid FROM users WHERE id = ?`,
        args: [userId],
      });

      const puuid = userResult.rows[0]?.puuid as string | undefined;
      if (!puuid) {
        skipped++;
        continue;
      }

      const participant = participants.find((p: { puuid: string }) => p.puuid === puuid);

      if (!participant) {
        skipped++;
        continue;
      }

      const position = participant.teamPosition || participant.individualPosition || null;

      if (!position) {
        skipped++;
        continue;
      }

      await db.execute({
        sql: `UPDATE matches SET position = ? WHERE id = ? AND user_id = ?`,
        args: [position, matchId, userId],
      });
      updated++;
    } catch {
      console.log(`  Warning: failed to parse match ${matchId}`);
      skipped++;
    }
  }

  console.log(`Backfill complete! Updated: ${updated}, Skipped: ${skipped}`);
}

main().catch(console.error);
