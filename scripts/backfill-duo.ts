/**
 * backfill-duo — Parse rawMatchJson for all existing matches and set
 * duoPartnerPuuid where the configured duo partner was on the same team.
 *
 * Usage:
 *   npx tsx scripts/backfill-duo.ts                     (local DB)
 *   npx @dotenvx/dotenvx run --env-file=.env.local -- npx tsx scripts/backfill-duo.ts  (production)
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

  // 1. Get all users with duoPartnerUserId set
  const usersResult = await db.execute(
    "SELECT id, puuid, duo_partner_user_id FROM users WHERE duo_partner_user_id IS NOT NULL"
  );

  if (usersResult.rows.length === 0) {
    console.log("No users have a duo partner configured. Nothing to backfill.");
    return;
  }

  for (const userRow of usersResult.rows) {
    const userId = userRow.id as string;
    const userPuuid = userRow.puuid as string;
    const duoPartnerUserId = userRow.duo_partner_user_id as string;

    if (!userPuuid) {
      console.log(`User ${userId} has no puuid linked. Skipping.`);
      continue;
    }

    // Get duo partner's puuid
    const partnerResult = await db.execute({
      sql: "SELECT puuid, riot_game_name, riot_tag_line FROM users WHERE id = ?",
      args: [duoPartnerUserId],
    });

    if (partnerResult.rows.length === 0) {
      console.log(`Duo partner ${duoPartnerUserId} not found. Skipping user ${userId}.`);
      continue;
    }

    const partnerPuuid = partnerResult.rows[0].puuid as string;
    const partnerName = `${partnerResult.rows[0].riot_game_name}#${partnerResult.rows[0].riot_tag_line}`;

    if (!partnerPuuid) {
      console.log(`Duo partner ${partnerName} has no puuid. Skipping.`);
      continue;
    }

    console.log(`Processing user ${userId} -> duo partner ${partnerName} (${partnerPuuid})`);

    // 2. Get all matches for this user that have rawMatchJson
    const matchesResult = await db.execute({
      sql: "SELECT id, raw_match_json FROM matches WHERE user_id = ? AND raw_match_json IS NOT NULL",
      args: [userId],
    });

    console.log(`  Found ${matchesResult.rows.length} matches with raw JSON`);

    let updated = 0;
    let duoFound = 0;

    for (const matchRow of matchesResult.rows) {
      const matchId = matchRow.id as string;
      const rawJson = matchRow.raw_match_json as string;

      try {
        const matchData = JSON.parse(rawJson);
        const participants = matchData?.info?.participants;
        if (!Array.isArray(participants)) continue;

        // Find the player
        const player = participants.find((p: { puuid: string }) => p.puuid === userPuuid);
        if (!player) continue;

        // Find duo partner on same team
        const partner = participants.find(
          (p: { puuid: string; teamId: number }) =>
            p.puuid === partnerPuuid && p.teamId === player.teamId
        );

        if (partner) {
          await db.execute({
            sql: "UPDATE matches SET duo_partner_puuid = ? WHERE id = ? AND user_id = ?",
            args: [partnerPuuid, matchId, userId],
          });
          duoFound++;
        }
        updated++;
      } catch {
        console.log(`  Warning: failed to parse match ${matchId}`);
      }
    }

    console.log(`  Processed ${updated} matches, found duo in ${duoFound} games\n`);
  }

  console.log("Backfill complete!");
}

main().catch(console.error);
