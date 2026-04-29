#!/usr/bin/env npx tsx
// scripts/audit-review-migration.ts
//
// Pre-migration audit for the review & action items overhaul (migration 0032).
// Connects to the target database READ-ONLY and reports what data will be
// affected when the migration runs on deploy.
//
// Usage:
//   Dry-run against production (read-only):
//     TURSO_DATABASE_URL=... TURSO_AUTH_TOKEN=... npx tsx scripts/audit-review-migration.ts
//
//   Local DB:
//     npx tsx scripts/audit-review-migration.ts
//
// This script does NOT modify any data. It only runs SELECT queries.

import type { Value } from "@libsql/client";

import { createClient } from "@libsql/client";

/** Safely convert a libsql Value to string for display */
function s(v: Value): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "bigint") return v.toString();
  if (v instanceof ArrayBuffer) return `[ArrayBuffer ${v.byteLength}b]`;
  return String(v);
}

function cleanEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val.replace(/^\[dotenv@[^\]]+\][^\n]*\n/, "");
}

const url = cleanEnv("TURSO_DATABASE_URL") || "file:./data/levelrise.db";
const authToken = cleanEnv("TURSO_AUTH_TOKEN");

console.log(`\n🔍 Review Migration Audit`);
console.log(`   Target: ${url}`);
console.log(`   Mode:   READ-ONLY (no data will be modified)\n`);

const client = createClient({ url, authToken });

async function main() {
  // Check if migration 0032 has already been applied
  try {
    const applied = await client.execute({
      sql: `SELECT * FROM __drizzle_migrations WHERE tag LIKE '%0032%'`,
      args: [],
    });
    if (applied.rows.length > 0) {
      console.log("⚠️  Migration 0032 has ALREADY been applied to this database.");
      console.log("   Nothing to audit — the migration already ran.\n");
      process.exit(0);
    }
  } catch {
    // Table might not exist (fresh DB)
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("1. HIGHLIGHTS WITH TEXT (will be merged into comment field)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const highlightsWithText = await client.execute({
    sql: `
      SELECT mh.match_id, mh.type, mh.text, t.name as topic_name, m.champion_name, m.game_date
      FROM match_highlights mh
      LEFT JOIN topics t ON t.id = mh.topic_id
      LEFT JOIN matches m ON m.id = mh.match_id
      WHERE mh.text IS NOT NULL AND mh.text != ''
      ORDER BY m.game_date DESC
    `,
    args: [],
  });

  if (highlightsWithText.rows.length === 0) {
    console.log("   None — no highlights have text content.\n");
  } else {
    console.log(`   ${highlightsWithText.rows.length} highlights with text across matches:\n`);
    const byMatch = new Map<string, typeof highlightsWithText.rows>();
    for (const row of highlightsWithText.rows) {
      const matchId = row.match_id as string;
      if (!byMatch.has(matchId)) byMatch.set(matchId, []);
      byMatch.get(matchId)!.push(row);
    }
    for (const [matchId, rows] of byMatch) {
      const first = rows[0];
      console.log(
        `   📋 ${s(first.champion_name)} (${new Date(Number(first.game_date) * 1000).toISOString().slice(0, 10)}) [${matchId.slice(0, 12)}...]`,
      );
      for (const row of rows) {
        const emoji = row.type === "highlight" ? "✅" : "❌";
        const topic = row.topic_name ? `[${s(row.topic_name)}]` : "";
        console.log(`      ${emoji} ${topic} ${s(row.text)}`);
      }
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("2. REVIEW NOTES (will be appended to comment field)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check if review_notes column exists
  let hasReviewNotes = false;
  try {
    await client.execute({ sql: `SELECT review_notes FROM matches LIMIT 1`, args: [] });
    hasReviewNotes = true;
  } catch {
    console.log("   Column 'review_notes' does not exist — already migrated.\n");
  }

  if (hasReviewNotes) {
    const reviewNotes = await client.execute({
      sql: `
        SELECT id, champion_name, game_date, review_notes, comment
        FROM matches
        WHERE review_notes IS NOT NULL AND review_notes != ''
        ORDER BY game_date DESC
      `,
      args: [],
    });

    if (reviewNotes.rows.length === 0) {
      console.log("   None — no matches have review_notes.\n");
    } else {
      console.log(`   ${reviewNotes.rows.length} matches with review_notes:\n`);
      for (const row of reviewNotes.rows) {
        const date = new Date(Number(row.game_date) * 1000).toISOString().slice(0, 10);
        const hasComment = row.comment && s(row.comment).trim();
        console.log(`   📋 ${s(row.champion_name)} (${date}) [${s(row.id).slice(0, 12)}...]`);
        console.log(
          `      review_notes: "${s(row.review_notes).slice(0, 100)}${s(row.review_notes).length > 100 ? "..." : ""}"`,
        );
        if (hasComment) {
          console.log(
            `      existing comment: "${s(row.comment).slice(0, 100)}${s(row.comment).length > 100 ? "..." : ""}"`,
          );
          console.log(`      → Will APPEND review_notes after existing comment (separated by ---)`);
        } else {
          console.log(`      → Will BECOME the comment (no existing comment)`);
        }
      }
      console.log();
    }
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("3. ACTION ITEMS STATUS MIGRATION");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const actionItemStatuses = await client.execute({
    sql: `
      SELECT status, COUNT(*) as count
      FROM coaching_action_items
      GROUP BY status
      ORDER BY status
    `,
    args: [],
  });

  if (actionItemStatuses.rows.length === 0) {
    console.log("   No action items found.\n");
  } else {
    for (const row of actionItemStatuses.rows) {
      const willChange = row.status === "pending" || row.status === "in_progress";
      console.log(
        `   ${s(row.status)}: ${s(row.count)}${willChange ? " → will become 'active'" : ""}`,
      );
    }
    console.log();
  }

  console.log("═══════════════════════════════════════════════════════════════");
  console.log("4. COLUMNS TO DROP");
  console.log("═══════════════════════════════════════════════════════════════\n");

  // Check if review_skipped_reason column exists
  let hasSkippedReason = false;
  try {
    await client.execute({ sql: `SELECT review_skipped_reason FROM matches LIMIT 1`, args: [] });
    hasSkippedReason = true;
  } catch {
    // already dropped
  }

  const skippedReasonCount = hasSkippedReason
    ? (
        await client.execute({
          sql: `SELECT COUNT(*) as count FROM matches WHERE review_skipped_reason IS NOT NULL AND review_skipped_reason != ''`,
          args: [],
        })
      ).rows[0].count
    : 0;

  console.log(
    `   matches.review_notes:          ${hasReviewNotes ? "EXISTS — will be dropped (data merged into comment first)" : "already dropped"}`,
  );
  console.log(
    `   matches.review_skipped_reason:  ${hasSkippedReason ? `EXISTS — will be dropped (${s(skippedReasonCount)} non-empty values will be LOST)` : "already dropped"}`,
  );

  if (Number(skippedReasonCount) > 0) {
    console.log(
      `\n   ⚠️  ${s(skippedReasonCount)} review skip reasons will be permanently deleted.`,
    );
    const skipReasons = await client.execute({
      sql: `SELECT id, champion_name, game_date, review_skipped_reason FROM matches WHERE review_skipped_reason IS NOT NULL AND review_skipped_reason != '' ORDER BY game_date DESC`,
      args: [],
    });
    for (const row of skipReasons.rows) {
      const date = new Date(Number(row.game_date) * 1000).toISOString().slice(0, 10);
      console.log(`      ${s(row.champion_name)} (${date}): "${s(row.review_skipped_reason)}"`);
    }
  }

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("SUMMARY");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const totalMatches = (
    await client.execute({ sql: `SELECT COUNT(*) as c FROM matches`, args: [] })
  ).rows[0].c;
  const reviewedMatches = (
    await client.execute({ sql: `SELECT COUNT(*) as c FROM matches WHERE reviewed = 1`, args: [] })
  ).rows[0].c;
  const totalHighlights = (
    await client.execute({ sql: `SELECT COUNT(*) as c FROM match_highlights`, args: [] })
  ).rows[0].c;

  console.log(`   Total matches:     ${s(totalMatches)}`);
  console.log(`   Reviewed matches:  ${s(reviewedMatches)}`);
  console.log(`   Total highlights:  ${s(totalHighlights)}`);
  console.log(
    `   Highlights w/text: ${highlightsWithText.rows.length} (text will be merged into comment, then ignored)`,
  );
  console.log(
    `   Action items:      ${actionItemStatuses.rows.reduce((sum, r) => sum + Number(r.count), 0)}`,
  );
  console.log();
  console.log("   ✅ No data will be lost (highlight text + review_notes → comment field)");
  if (Number(skippedReasonCount) > 0) {
    console.log(
      `   ⚠️  ${s(skippedReasonCount)} review_skipped_reason values will be dropped (see above)`,
    );
  }
  console.log(`\n   This audit is READ-ONLY. To apply the migration, merge the PR and deploy.\n`);

  client.close();
}

main().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
