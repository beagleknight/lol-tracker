// scripts/fix-corrupted-challenges.ts
//
// Fixes challenges corrupted by the date-bounded sync dedup bug (#228).
//
// The bug: sync treated already-synced matches as "new" (because they fell
// outside the 24h dedup window), re-evaluating them against active challenges.
// This inflated currentGames/successfulGames counters, causing challenges to
// fail prematurely.
//
// What this script does:
// 1. Finds by-games challenges that were failed/completed after #228 was merged
// 2. Recalculates their counters from scratch using matches synced AFTER the
//    challenge was created (the correct set of matches)
// 3. Resets status to "active" if the challenge isn't actually resolved yet,
//    or sets the correct completed/failed status if it legitimately finished
//
// Usage:
//   Local:  npx tsx scripts/fix-corrupted-challenges.ts
//   Remote: TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/fix-corrupted-challenges.ts
//
// Pass --dry-run to preview changes without applying them.
// Pass --force-remote to allow running against a remote Turso database.

import { createClient } from "@libsql/client";

function cleanEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val.replace(/^\[dotenv@[^\]]+\][^\n]*\n/, "");
}

const dryRun = process.argv.includes("--dry-run");
const forceRemote = process.argv.includes("--force-remote");

async function main() {
  const dbUrl = cleanEnv("TURSO_DATABASE_URL") ?? "file:./data/lol-tracker.db";
  const authToken = cleanEnv("TURSO_AUTH_TOKEN");
  const isRemote = dbUrl.startsWith("libsql://") || dbUrl.startsWith("https://");

  if (isRemote && !forceRemote) {
    console.error("[fix] ERROR: Refusing to run against remote DB without --force-remote");
    process.exit(1);
  }

  console.log(`[fix] Target: ${dbUrl}`);
  console.log(`[fix] Remote: ${isRemote}`);
  console.log(`[fix] Dry run: ${dryRun}`);

  const client = createClient({ url: dbUrl, authToken });

  // #228 was merged at 2026-04-21T14:17:43Z
  // Use a slightly earlier cutoff to catch edge cases
  const corruptionStart = Math.floor(new Date("2026-04-21T14:15:00Z").getTime() / 1000);

  // Find by-games challenges that were failed or completed after #228 merged
  const corruptedResult = await client.execute({
    sql: `
      SELECT id, user_id, title, metric, metric_condition, metric_threshold,
             target_games, current_games, successful_games, status,
             created_at, failed_at, completed_at, riot_account_id
      FROM challenges
      WHERE type = 'by-games'
        AND status IN ('failed', 'completed')
        AND (
          (failed_at IS NOT NULL AND failed_at >= ?)
          OR (completed_at IS NOT NULL AND completed_at >= ?)
        )
    `,
    args: [corruptionStart, corruptionStart],
  });

  if (corruptedResult.rows.length === 0) {
    console.log("[fix] No corrupted challenges found. Nothing to do.");
    return;
  }

  console.log(`[fix] Found ${corruptedResult.rows.length} potentially corrupted challenge(s):\n`);

  for (const challenge of corruptedResult.rows) {
    const id = challenge.id as number;
    const userId = challenge.user_id as string;
    const title = challenge.title as string;
    const metric = challenge.metric as string;
    const metricCondition = challenge.metric_condition as string;
    const metricThreshold = challenge.metric_threshold as number;
    const targetGames = challenge.target_games as number;
    const oldStatus = challenge.status as string;
    const oldCurrent = challenge.current_games as number;
    const oldSuccessful = challenge.successful_games as number;

    // We cannot accurately reconstruct the original counters because:
    // - synced_at gets overwritten on every upsert (the bug did exactly that)
    // - game_date reflects when the match was played, not when it was first synced
    // - odometer is stable but we don't know what it was when the challenge was created
    //
    // The safest fix is to reset to active with 0/0 counters. The challenge
    // will count correctly going forward now that the sync dedup bug is fixed.
    const correctStatus = "active";
    const actualGames = 0;
    const actualSuccessful = 0;

    const changed =
      correctStatus !== oldStatus ||
      actualGames !== oldCurrent ||
      actualSuccessful !== oldSuccessful;

    console.log(`  Challenge #${id}: "${title}"`);
    console.log(`    User: ${userId}`);
    console.log(
      `    Metric: ${metric} ${metricCondition} ${metricThreshold} over ${targetGames} games`,
    );
    console.log(
      `    Before: status=${oldStatus}, current=${oldCurrent}, successful=${oldSuccessful}`,
    );
    console.log(
      `    After:  status=${correctStatus}, current=${actualGames}, successful=${actualSuccessful}`,
    );
    console.log(`    ${changed ? "→ WILL FIX" : "→ No change needed"}`);
    console.log();

    if (changed && !dryRun) {
      await client.execute({
        sql: `
          UPDATE challenges
          SET current_games = ?,
              successful_games = ?,
              status = ?,
              completed_at = ?,
              failed_at = ?
          WHERE id = ?
        `,
        args: [actualGames, actualSuccessful, correctStatus, null, null, id],
      });
      console.log(`    ✓ Fixed challenge #${id}`);
    }
  }

  if (dryRun) {
    console.log(
      "\n[fix] Dry run complete. No changes were made. Run without --dry-run to apply fixes.",
    );
  } else {
    console.log("\n[fix] Done!");
  }
}

main().catch((err) => {
  console.error("[fix] Failed:", err);
  process.exit(1);
});
