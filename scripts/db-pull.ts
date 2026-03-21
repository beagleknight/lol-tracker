/**
 * db:pull — Copy all data from production (Turso) into local SQLite.
 *
 * Usage:  npm run db:pull
 *         npm run db:pull -- --yes   (skip confirmation)
 *
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local
 * Local database path: ./data/lol-tracker.db
 *
 * WARNING: This replaces ALL local data with production data.
 */

import { createClient, type InValue } from "@libsql/client";
import * as readline from "readline";

// ── Table definitions in FK-safe order (parents before children) ──────────────
const TABLES_ORDERED = [
  "users",
  "matches",
  "rank_snapshots",
  "coaching_sessions",
  "coaching_session_matches",
  "coaching_action_items",
  "invites",
];

// Reverse order for deletion (children before parents)
const TABLES_DELETE_ORDER = [...TABLES_ORDERED].reverse();

function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });
}

async function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error(
      "Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local"
    );
    process.exit(1);
  }

  console.log("Connecting to production (Turso)...");
  const remote = createClient({ url: tursoUrl, authToken: tursoToken });

  console.log("Connecting to local SQLite...");
  const local = createClient({ url: "file:./data/lol-tracker.db" });

  // Read all data from production
  console.log("\n── Production data ──");
  const data: Record<string, Record<string, unknown>[]> = {};
  let remoteTotalRows = 0;

  for (const table of TABLES_ORDERED) {
    const result = await remote.execute(`SELECT * FROM ${table}`);
    data[table] = result.rows as unknown as Record<string, unknown>[];
    remoteTotalRows += data[table].length;
    console.log(`  ${table}: ${data[table].length} rows`);
  }

  // Count local data
  console.log("\n── Local data (will be replaced) ──");
  let localTotalRows = 0;

  for (const table of TABLES_ORDERED) {
    const result = await local.execute(
      `SELECT COUNT(*) as count FROM ${table}`
    );
    const count = Number((result.rows[0] as Record<string, unknown>).count);
    localTotalRows += count;
    console.log(`  ${table}: ${count} rows`);
  }

  // Safety check: warn if local has more data than production
  if (localTotalRows > 0 && remoteTotalRows < localTotalRows) {
    console.log(
      `\n⚠ WARNING: Local has ${localTotalRows} rows but production only has ${remoteTotalRows}.`
    );
    console.log(
      "  Pulling will DELETE local data that does not exist in production."
    );
    console.log(
      "  If you want to preserve local data, use db:push first."
    );
  }

  // Confirm before overwriting
  if (!process.argv.includes("--yes")) {
    const ok = await confirm(
      `\nReplace all local data with ${remoteTotalRows} rows from production? [y/N] `
    );
    if (!ok) {
      console.log("Aborted.");
      remote.close();
      local.close();
      return;
    }
  }

  // Clear local tables (children first)
  console.log("\n── Clearing local tables ──");
  for (const table of TABLES_DELETE_ORDER) {
    await local.execute(`DELETE FROM ${table}`);
    console.log(`  Cleared ${table}`);
  }

  // Insert into local (parents first)
  console.log("\n── Inserting into local ──");
  for (const table of TABLES_ORDERED) {
    const rows = data[table];
    if (rows.length === 0) {
      console.log(`  ${table}: skipped (empty)`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

    let inserted = 0;
    for (const row of rows) {
      const values = columns.map((col) => (row[col] as InValue) ?? null);
      await local.execute({ sql, args: values });
      inserted++;
    }
    console.log(`  ${table}: ${inserted} rows inserted`);
  }

  console.log("\nPull complete.");
  remote.close();
  local.close();
}

main().catch((err) => {
  console.error("Pull failed:", err);
  process.exit(1);
});
