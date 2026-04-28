/**
 * db:push — Upsert local SQLite data into production (Turso).
 *
 * Usage:  npm run db:push
 *
 * Requires TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in .env.local
 * Local database path: ./data/levelrise.db
 *
 * Safety: UPSERT only — inserts new rows, updates existing ones.
 *         Never deletes production data.
 *
 * For tables with natural/stable primary keys (users, matches),
 * we upsert on the primary key directly.
 *
 * For auto-increment tables (rank_snapshots, coaching_sessions, etc.),
 * we match on business-meaningful columns to detect duplicates,
 * then insert only genuinely new rows.
 */

import { createClient, type InValue } from "@libsql/client";
import * as readline from "readline";

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Table metadata ───────────────────────────────────────────────────────────

interface TableConfig {
  name: string;
  /** Primary key column(s) */
  pk: string[];
  /** Whether PK is auto-increment (must be handled differently) */
  autoIncrement: boolean;
  /**
   * For auto-increment tables: columns that together identify a unique
   * business record (used to detect if a row already exists in production).
   */
  businessKey?: string[];
  /** Columns to update on conflict (upsert). If empty, skip update. */
  updateCols?: string[];
}

const TABLES: TableConfig[] = [
  {
    name: "users",
    pk: ["id"],
    autoIncrement: false,
    updateCols: [
      "name",
      "image",
      "email",
      "riot_game_name",
      "riot_tag_line",
      "puuid",
      "summoner_id",
      "role",
      "updated_at",
    ],
  },
  {
    name: "matches",
    pk: ["id", "user_id"],
    autoIncrement: false,
    updateCols: [
      "comment",
      "reviewed",
      "review_notes",
      "kills",
      "deaths",
      "assists",
      "cs",
      "cs_per_min",
      "game_duration_seconds",
      "gold_earned",
      "vision_score",
      "rune_keystone_id",
      "rune_keystone_name",
      "matchup_champion_id",
      "matchup_champion_name",
      "raw_match_json",
    ],
  },
  {
    name: "rank_snapshots",
    pk: ["id"],
    autoIncrement: true,
    businessKey: ["user_id", "captured_at"],
    updateCols: ["tier", "division", "lp", "wins", "losses"],
  },
  {
    name: "coaching_sessions",
    pk: ["id"],
    autoIncrement: true,
    businessKey: ["user_id", "coach_name", "date"],
    updateCols: ["duration_minutes", "topics", "notes", "updated_at"],
  },
  {
    name: "coaching_session_matches",
    pk: ["session_id", "match_id"],
    autoIncrement: false,
    // This is a junction table — we handle it specially after coaching_sessions
  },
  {
    name: "coaching_action_items",
    pk: ["id"],
    autoIncrement: true,
    businessKey: ["session_id", "user_id", "description"],
    updateCols: ["topic", "status", "completed_at"],
  },
  {
    name: "invites",
    pk: ["id"],
    autoIncrement: true,
    businessKey: ["code"],
    updateCols: ["used_by", "used_at"],
  },
];

async function main() {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const tursoToken = process.env.TURSO_AUTH_TOKEN;

  if (!tursoUrl || !tursoToken) {
    console.error("Error: TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be set in .env.local");
    process.exit(1);
  }

  console.log("Connecting to local SQLite...");
  const local = createClient({ url: "file:./data/levelrise.db" });

  console.log("Connecting to production (Turso)...");
  const remote = createClient({ url: tursoUrl, authToken: tursoToken });

  // Read all local data
  console.log("\n── Reading local data ──");
  const localData: Record<string, Record<string, unknown>[]> = {};
  let totalRows = 0;

  for (const table of TABLES) {
    const result = await local.execute(`SELECT * FROM ${table.name}`);
    localData[table.name] = result.rows as unknown as Record<string, unknown>[];
    const count = localData[table.name].length;
    totalRows += count;
    console.log(`  ${table.name}: ${count} rows`);
  }

  if (totalRows === 0) {
    console.log("\nNothing to push — local database is empty.");
    remote.close();
    local.close();
    return;
  }

  // Confirm before pushing
  if (!process.argv.includes("--yes")) {
    const confirmed = await confirm(
      `\nYou are about to upsert ${totalRows} rows into production. Continue? [y/N] `,
    );
    if (!confirmed) {
      console.log("Aborted.");
      remote.close();
      local.close();
      return;
    }
  }

  // We need to track ID mappings for auto-increment tables.
  // When we insert a coaching_session with local id=5, production might assign id=12.
  // coaching_session_matches and coaching_action_items reference session_id,
  // so we need to remap those.
  const sessionIdMap = new Map<number, number>(); // local session_id -> remote session_id

  console.log("\n── Pushing to production (upsert) ──");

  for (const table of TABLES) {
    const rows = localData[table.name];
    if (rows.length === 0) {
      console.log(`  ${table.name}: skipped (empty)`);
      continue;
    }

    // Special handling for coaching_session_matches — needs session ID remapping
    if (table.name === "coaching_session_matches") {
      await pushSessionMatches(remote, rows, sessionIdMap);
      continue;
    }

    // Special handling for coaching_action_items — needs session ID remapping
    if (table.name === "coaching_action_items") {
      await pushActionItems(remote, rows, table, sessionIdMap);
      continue;
    }

    if (table.autoIncrement && table.businessKey) {
      await pushAutoIncrementTable(
        remote,
        rows,
        table,
        table.name === "coaching_sessions" ? sessionIdMap : undefined,
      );
    } else {
      await pushNaturalKeyTable(remote, rows, table);
    }
  }

  console.log("\nPush complete. No production data was deleted.");
  remote.close();
  local.close();
}

/**
 * Upsert rows for tables with natural/stable primary keys (users, matches).
 * Uses INSERT ... ON CONFLICT(pk) DO UPDATE.
 */
async function pushNaturalKeyTable(
  remote: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
  table: TableConfig,
) {
  const columns = Object.keys(rows[0]);
  const placeholders = columns.map(() => "?").join(", ");
  const pkConflict = table.pk.join(", ");

  let sql: string;
  if (table.updateCols && table.updateCols.length > 0) {
    const updateSet = table.updateCols.map((col) => `${col} = excluded.${col}`).join(", ");
    sql = `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${pkConflict}) DO UPDATE SET ${updateSet}`;
  } else {
    sql = `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT(${pkConflict}) DO NOTHING`;
  }

  let upserted = 0;
  for (const row of rows) {
    const values = columns.map((col) => (row[col] as InValue) ?? null);
    await remote.execute({ sql, args: values });
    upserted++;
  }
  console.log(`  ${table.name}: ${upserted} rows upserted`);
}

/**
 * For auto-increment tables: check if a row with the same business key
 * exists in production. If yes, update it. If no, insert (letting the
 * DB assign a new auto-increment ID).
 */
async function pushAutoIncrementTable(
  remote: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
  table: TableConfig,
  idMap?: Map<number, number>,
) {
  const businessKey = table.businessKey!;
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    // Check if this row already exists in production by business key
    const whereClause = businessKey.map((col) => `${col} = ?`).join(" AND ");
    const whereValues = businessKey.map((col) => (row[col] as InValue) ?? null);

    const existing = await remote.execute({
      sql: `SELECT * FROM ${table.name} WHERE ${whereClause} LIMIT 1`,
      args: whereValues,
    });

    if (existing.rows.length > 0) {
      // Update existing row
      const remoteRow = existing.rows[0] as unknown as Record<string, unknown>;
      if (table.updateCols && table.updateCols.length > 0) {
        const setClause = table.updateCols.map((col) => `${col} = ?`).join(", ");
        const setValues = table.updateCols.map((col) => (row[col] as InValue) ?? null);
        const pkWhere = table.pk.map((col) => `${col} = ?`).join(" AND ");
        const pkValues = table.pk.map((col) => (remoteRow[col] as InValue) ?? null);

        await remote.execute({
          sql: `UPDATE ${table.name} SET ${setClause} WHERE ${pkWhere}`,
          args: [...setValues, ...pkValues],
        });
      }

      // Track the ID mapping
      if (idMap) {
        const localId = row[table.pk[0]] as number;
        const remoteId = remoteRow[table.pk[0]] as number;
        idMap.set(localId, remoteId);
      }
      updated++;
    } else {
      // Insert new row (without the auto-increment ID)
      const columns = Object.keys(row).filter((col) => !table.pk.includes(col));
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((col) => (row[col] as InValue) ?? null);

      const result = await remote.execute({
        sql: `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${placeholders})`,
        args: values,
      });

      // Track the ID mapping
      if (idMap) {
        const localId = row[table.pk[0]] as number;
        const remoteId = Number(result.lastInsertRowid);
        idMap.set(localId, remoteId);
      }
      inserted++;
    }
  }
  console.log(`  ${table.name}: ${inserted} inserted, ${updated} updated`);
}

/**
 * Push coaching_session_matches with session ID remapping.
 */
async function pushSessionMatches(
  remote: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
  sessionIdMap: Map<number, number>,
) {
  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const localSessionId = row["session_id"] as number;
    const matchId = row["match_id"] as InValue;
    const userId = row["user_id"] as InValue;

    // Remap session ID
    const remoteSessionId = sessionIdMap.get(localSessionId) ?? localSessionId;

    // Check if already exists
    const existing = await remote.execute({
      sql: `SELECT 1 FROM coaching_session_matches WHERE session_id = ? AND match_id = ? LIMIT 1`,
      args: [remoteSessionId, matchId],
    });

    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await remote.execute({
      sql: `INSERT INTO coaching_session_matches (session_id, match_id, user_id) VALUES (?, ?, ?)`,
      args: [remoteSessionId, matchId, userId],
    });
    inserted++;
  }
  console.log(`  coaching_session_matches: ${inserted} inserted, ${skipped} already existed`);
}

/**
 * Push coaching_action_items with session ID remapping.
 */
async function pushActionItems(
  remote: ReturnType<typeof createClient>,
  rows: Record<string, unknown>[],
  table: TableConfig,
  sessionIdMap: Map<number, number>,
) {
  const businessKey = table.businessKey!;
  let inserted = 0;
  let updated = 0;

  for (const row of rows) {
    const localSessionId = row["session_id"] as number;
    const remoteSessionId = sessionIdMap.get(localSessionId) ?? localSessionId;

    // Build business key with remapped session_id
    const whereClause = businessKey.map((col) => `${col} = ?`).join(" AND ");
    const whereValues = businessKey.map((col) => {
      if (col === "session_id") return remoteSessionId as InValue;
      return (row[col] as InValue) ?? null;
    });

    const existing = await remote.execute({
      sql: `SELECT * FROM ${table.name} WHERE ${whereClause} LIMIT 1`,
      args: whereValues,
    });

    if (existing.rows.length > 0) {
      // Update existing
      const remoteRow = existing.rows[0] as unknown as Record<string, unknown>;
      if (table.updateCols && table.updateCols.length > 0) {
        const setClause = table.updateCols.map((col) => `${col} = ?`).join(", ");
        const setValues = table.updateCols.map((col) => (row[col] as InValue) ?? null);
        const pkWhere = table.pk.map((col) => `${col} = ?`).join(" AND ");
        const pkValues = table.pk.map((col) => (remoteRow[col] as InValue) ?? null);

        await remote.execute({
          sql: `UPDATE ${table.name} SET ${setClause} WHERE ${pkWhere}`,
          args: [...setValues, ...pkValues],
        });
      }
      updated++;
    } else {
      // Insert without auto-increment ID, with remapped session_id
      const columns = Object.keys(row).filter((col) => !table.pk.includes(col));
      const placeholders = columns.map(() => "?").join(", ");
      const values = columns.map((col) => {
        if (col === "session_id") return remoteSessionId as InValue;
        return (row[col] as InValue) ?? null;
      });

      await remote.execute({
        sql: `INSERT INTO ${table.name} (${columns.join(", ")}) VALUES (${placeholders})`,
        args: values,
      });
      inserted++;
    }
  }
  console.log(`  coaching_action_items: ${inserted} inserted, ${updated} updated`);
}

main().catch((err) => {
  console.error("Push failed:", err);
  process.exit(1);
});
