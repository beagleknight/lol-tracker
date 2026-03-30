/**
 * backfill-duo-stats — Populate the denormalized duo partner columns
 * (duo_partner_champion_name, duo_partner_kills, duo_partner_deaths,
 * duo_partner_assists) for matches that already have duo_partner_puuid
 * set but are missing the new columns.
 *
 * Usage:
 *   npx tsx scripts/backfill-duo-stats.ts                     (local DB)
 *   npx @dotenvx/dotenvx run --env-file=.env.local -- npx tsx scripts/backfill-duo-stats.ts  (production)
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

  // Get all duo matches missing the denormalized partner champion name
  const result = await db.execute(
    `SELECT id, user_id, duo_partner_puuid, raw_match_json
     FROM matches
     WHERE duo_partner_puuid IS NOT NULL
       AND duo_partner_champion_name IS NULL
       AND raw_match_json IS NOT NULL`,
  );

  console.log(`Found ${result.rows.length} duo matches needing backfill\n`);

  let updated = 0;
  let skipped = 0;

  for (const row of result.rows) {
    const matchId = row.id as string;
    const userId = row.user_id as string;
    const duoPartnerPuuid = row.duo_partner_puuid as string;
    const rawJson = row.raw_match_json as string;

    try {
      const matchData = JSON.parse(rawJson);
      const participants = matchData?.info?.participants;
      if (!Array.isArray(participants)) {
        skipped++;
        continue;
      }

      const partner = participants.find((p: { puuid: string }) => p.puuid === duoPartnerPuuid);

      if (!partner) {
        skipped++;
        continue;
      }

      await db.execute({
        sql: `UPDATE matches
              SET duo_partner_champion_name = ?,
                  duo_partner_kills = ?,
                  duo_partner_deaths = ?,
                  duo_partner_assists = ?
              WHERE id = ? AND user_id = ?`,
        args: [
          partner.championName,
          partner.kills,
          partner.deaths,
          partner.assists,
          matchId,
          userId,
        ],
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
