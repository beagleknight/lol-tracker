---
name: drizzle-schema
description: Drizzle ORM schema management with Turso/libSQL, migrations, indexes, query optimization, and safe upsert-only data sync patterns
---

## What I do

Guide Drizzle ORM schema design, migration workflows, index optimization, query performance, and data synchronization between local SQLite and production Turso databases.

## When to use me

- Adding or modifying database tables/columns
- Creating or reviewing database indexes
- Running migrations with `drizzle-kit`
- Syncing data between local development and production
- Optimizing query performance with proper indexing and query patterns
- Writing efficient Drizzle queries (pagination, aggregates, filtered lookups)

## Schema conventions in this project

### File locations

- Schema definition: `src/db/schema.ts`
- DB client (lazy Proxy): `src/db/index.ts`
- Drizzle config: `drizzle.config.ts`
- Migrations: `drizzle/` directory
- Sync scripts: `scripts/db-pull.ts`, `scripts/db-push.ts`

### Drizzle config

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL ?? "file:./data/lol-tracker.db",
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
```

### Schema patterns

- UUIDs for user IDs: `text("id").primaryKey()` with `crypto.randomUUID()`
- Riot match IDs as natural keys: `text("id").primaryKey()` (e.g., `"EUW1_7234567890"`)
- Auto-increment for relationship tables: `integer("id").primaryKey({ autoIncrement: true })`
- Timestamps as integers: `integer("created_at", { mode: "timestamp" })` with `.$defaultFn(() => new Date())`
- Enums as text: `text("role", { enum: ["admin", "user"] })`
- Foreign keys with cascade: `.references(() => users.id, { onDelete: "cascade" })`

### Composite indexes

Add indexes on columns frequently used in WHERE + ORDER BY clauses:

```ts
export const matches = sqliteTable(
  "matches",
  {
    // ... columns
  },
  (table) => [
    index("idx_matches_user_game_date").on(table.userId, table.gameDate),
    index("idx_matches_user_champion").on(table.userId, table.championName),
  ],
);
```

Always add indexes when:

- A page filters by `userId` (every page does in a multi-user app)
- Queries sort by a date/timestamp column
- Queries filter on status, type, or category columns alongside userId

## Migration workflow

**Important**: `drizzle-kit migrate` and `drizzle-kit push` do NOT work reliably with dotenvx because `drizzle.config.ts` reads env vars at module scope (before any banner stripping). See the `vercel-turso-deploy` skill for the full explanation and workaround.

### Steps

1. Modify `src/db/schema.ts`
2. Generate migration: `npx drizzle-kit generate`
3. Review the generated SQL in `drizzle/XXXX_*.sql`
4. **Ensure `--> statement-breakpoint` separators exist between every SQL statement.** The migration runner (`scripts/migrate.ts`) splits on this marker and sends each statement individually — Turso/libSQL rejects multiple statements in a single `execute()` call. Hand-written migrations are especially prone to missing these separators. Drizzle-generated migrations include them automatically.
5. **Review for data migration completeness** — see the "Data migration safety" section below
6. Apply locally: restart dev server (local SQLite picks up schema changes automatically)
7. **Apply to production Turso**: Write a standalone `scripts/apply-migration-XXXX.ts` script that uses `@libsql/client` directly with `cleanEnv()` banner stripping, then run via `npx @dotenvx/dotenvx run --env-file=.env.local -- npx tsx scripts/apply-migration-XXXX.ts`. See `vercel-turso-deploy` skill for the script template.
8. Verify migration succeeded before pushing code
9. **Push code only after production DB has the new schema** — Vercel does NOT run migrations on deploy

### Data migration safety — MANDATORY

**Incident reference**: Migration 0022 created the `riot_accounts` table but never copied existing user data from the `users` table. All production users lost their linked accounts and match history. CI didn't catch it because the seed script creates `riot_accounts` rows directly, masking the gap.

**Rules for every migration:**

1. **CREATE TABLE from existing data → include INSERT INTO ... SELECT FROM.**
   When a new table replaces or extends data from an existing table, the migration SQL MUST copy existing data:

   ```sql
   -- BAD: creates an empty table, production users lose data
   CREATE TABLE `riot_accounts` (...);

   -- GOOD: creates the table AND migrates existing data
   CREATE TABLE `riot_accounts` (...);
   INSERT INTO `riot_accounts` (id, user_id, puuid, ...)
   SELECT lower(hex(randomblob(16))), id, puuid, ...
   FROM `users` WHERE `puuid` IS NOT NULL;
   ```

2. **New FK column → backfill existing rows.**
   A new foreign key column that's NULL for all existing rows will make existing data invisible to queries that filter/join on it:

   ```sql
   ALTER TABLE `matches` ADD `riot_account_id` text REFERENCES riot_accounts(id);
   -- MUST also backfill:
   UPDATE `matches` SET `riot_account_id` = (
     SELECT ra.id FROM `riot_accounts` ra
     WHERE ra.user_id = `matches`.`user_id` AND ra.is_primary = 1
   ) WHERE `riot_account_id` IS NULL;
   ```

3. **Seed script creates data for new table? That's a red flag.**
   If the seed script directly inserts rows into a new table/column, ask: "Does the migration also handle this for existing production data?" The seed script creates demo data for testing — it does NOT run in production.

4. **Mental production test.**
   Before committing: "If I run this migration against a production database with 1000 users and 50,000 matches, will all existing data still be accessible through the new schema?" If the answer is no, the migration is incomplete.

5. **Write a `.validate.sql` companion file.**
   For any migration that creates tables or moves data, write `drizzle/XXXX_name.validate.sql` with assertions that verify data integrity. The migration runner executes these after applying the migration. See `scripts/migrate.ts` for the validation mechanism.

## Destructive migrations — MANDATORY expand-contract pattern

**CI blocks all destructive migrations.** The `migration-safety` CI check (`scripts/check-migration-safety.ts`) scans new migration SQL for `DROP TABLE`, `DROP COLUMN`, and `RENAME COLUMN` patterns. If found, CI fails and the PR cannot merge. There is no override mechanism — this is a hard blocker.

**Why**: Migrations run before `next build` on Vercel. The old deployment still serves traffic while the build runs. Destructive schema changes break the old code immediately, causing downtime until the new deployment goes live (minutes later).

**Incident reference**: PR #243 dropped columns from the `matches` table during deploy, causing a brief production outage (issue #246).

### The expand-contract pattern

All destructive schema changes MUST be split across multiple PRs:

**Phase 1 (PR 1) — Expand:**

- Add new columns/tables
- Deploy code that works with BOTH old and new schema
- No drops, no renames

**Phase 2 (PR 2, optional) — Migrate:**

- Backfill data from old columns to new columns
- Can be a data migration script or a SQL migration

**Phase 3 (PR 3, AFTER Phase 1 is live and verified) — Contract:**

- Drop old columns/tables in a separate migration
- Only safe because no running code references them anymore

### Example: renaming a column

```
-- BAD: Single migration (CI will block this)
ALTER TABLE matches RENAME COLUMN review_notes TO notes;

-- GOOD: Three-phase approach
-- Phase 1 migration: Add new column
ALTER TABLE matches ADD COLUMN notes text;
-- Phase 1 code: Write to BOTH columns, read from new (fallback to old)

-- Phase 2 migration: Backfill
UPDATE matches SET notes = review_notes WHERE notes IS NULL AND review_notes IS NOT NULL;

-- Phase 3 migration (separate PR): Drop old column
ALTER TABLE matches DROP COLUMN review_notes;
```

### Example: recreating a table to change column constraints

```
-- BAD: Single migration with table recreation (CI will block this)
CREATE TABLE match_highlights_new (...);
INSERT INTO match_highlights_new SELECT * FROM match_highlights;
DROP TABLE match_highlights;
ALTER TABLE match_highlights_new RENAME TO match_highlights;

-- GOOD: Use ALTER TABLE to add/modify columns where possible
-- If SQLite doesn't support the needed ALTER, split across phases:
-- Phase 1: Create new table + copy data + deploy code that reads from new table
-- Phase 3: Drop old table (separate PR)
```

**NEVER generate a single migration that adds new columns AND drops old ones.** Always split into separate PRs.

## Data sync (db-push / db-pull)

### Safety rules

- **UPSERT ONLY** — never delete production data
- Use `ON CONFLICT(pk) DO UPDATE SET ...` for natural-key tables
- For auto-increment tables, match on business-meaningful columns (e.g., `[user_id, captured_at]` for rank snapshots) to detect duplicates
- Track ID remappings when auto-increment IDs differ between local and production (e.g., coaching_sessions local id=5 might map to production id=12)
- Junction tables need ID remapping applied to foreign keys before insert
- Always confirm with user before pushing: `--yes` flag to skip confirmation

### Table categories

| Type           | Example                           | PK Strategy           | Upsert Strategy                          |
| -------------- | --------------------------------- | --------------------- | ---------------------------------------- |
| Natural key    | users, matches                    | UUID or Riot ID       | `ON CONFLICT(id) DO UPDATE`              |
| Auto-increment | rank_snapshots, coaching_sessions | integer autoincrement | Match on business key, insert without ID |
| Junction       | coaching_session_matches          | composite PK          | Remap foreign keys, `INSERT OR IGNORE`   |

## Query optimization patterns

### Exclude large columns on list pages

Don't SELECT `rawMatchJson` (50-100KB per row) unless on a detail page. Use explicit `columns`:

```ts
db.query.matches.findMany({
  where: eq(matches.userId, user.id),
  columns: {
    id: true,
    championName: true,
    result: true,
    kills: true,
    // rawMatchJson: NOT included — saves ~75KB per row
  },
});
```

### Server-side pagination with LIMIT/OFFSET

`findMany` supports `limit` and `offset` at the root level:

```ts
const PAGE_SIZE = 10;
const offset = (page - 1) * PAGE_SIZE;

const rows = await db.query.matches.findMany({
  where: whereClause,
  orderBy: desc(matches.gameDate),
  limit: PAGE_SIZE,
  offset,
  columns: {
    /* explicit columns */
  },
});
```

Note: `offset` is only available on root-level `findMany`, not in nested `with` relations.

### COUNT for total pages

Use `count()` from `drizzle-orm` with the same WHERE clause:

```ts
import { count } from "drizzle-orm";

const [countResult] = await db.select({ total: count() }).from(matches).where(whereClause);
const totalPages = Math.max(1, Math.ceil(countResult.total / PAGE_SIZE));
```

### SQL aggregates for stats

Use `sql` template for aggregates instead of fetching all rows and counting in JS:

```ts
const [stats] = await db
  .select({
    wins: sql<number>`SUM(CASE WHEN ${matches.result} = 'Victory' THEN 1 ELSE 0 END)`,
    losses: sql<number>`SUM(CASE WHEN ${matches.result} = 'Defeat' THEN 1 ELSE 0 END)`,
  })
  .from(matches)
  .where(whereClause);
```

### Scalar subqueries — use literal table names, NOT Drizzle column refs

**Incident reference**: The admin `getUsers` query used `${users.id}` inside a correlated scalar subquery. Drizzle's `sql` template renders column references **unqualified** (just `"id"`), so inside a subquery against `matches`, SQLite resolved `"id"` to `matches.id` instead of `users.id`. Result: `matches.user_id = matches.id` → always false → 0 matches for every user.

**Rule**: In correlated scalar subqueries, **always use literal quoted table.column** — never Drizzle column references like `${users.id}`.

```ts
// BAD — ${users.id} renders as unqualified "id", resolves to matches.id inside subquery
matchCount: sql<number>`(
  SELECT count(*) FROM matches WHERE matches.user_id = ${users.id}
)`.as("match_count"),

// GOOD — literal "users"."id" always refers to the outer table
matchCount: sql<number>`(
  SELECT count(*) FROM matches WHERE matches.user_id = "users"."id"
)`.as("match_count"),
```

This only affects correlated subqueries where the outer table column is referenced inside an inner SELECT. Normal WHERE clauses (e.g., `sql\`${matches.result} = 'Victory'\``) are fine because there's no ambiguity.

### Dynamic WHERE with and() + sql

Build conditions array and spread into `and()`:

```ts
import { and, eq, sql } from "drizzle-orm";

const conditions = [eq(matches.userId, user.id)];
if (result !== "all") conditions.push(eq(matches.result, result));
if (champion !== "all") conditions.push(eq(matches.championName, champion));
if (search) {
  const pattern = `%${search}%`;
  conditions.push(sql`(
    ${matches.championName} LIKE ${pattern}
    OR ${matches.comment} LIKE ${pattern}
  )`);
}
const whereClause = and(...conditions);
```

### Scoped related-data fetching with inArray

Fetch related rows only for the current page's items, not all user items:

```ts
import { inArray } from "drizzle-orm";

const matchIds = pageMatches.map((m) => m.id);
const highlights =
  matchIds.length > 0
    ? await db.query.matchHighlights.findMany({
        where: and(eq(matchHighlights.userId, user.id), inArray(matchHighlights.matchId, matchIds)),
      })
    : [];
```

Always guard `inArray()` with a length check — passing an empty array produces invalid SQL.

### Batch lookups to avoid N+1

```ts
// BAD — N+1
for (const invite of invites) {
  const user = await db.query.users.findFirst({ where: eq(users.id, invite.usedBy) });
}

// GOOD — single batch query
const userIds = invites.map((i) => i.usedBy).filter(Boolean);
const usersMap =
  userIds.length > 0
    ? Object.fromEntries(
        (
          await db.query.users.findMany({
            where: inArray(users.id, userIds),
          })
        ).map((u) => [u.id, u]),
      )
    : {};
```

### Parallelize independent queries

Wrap unrelated queries in `Promise.all`:

```ts
const [rows, countResult, champions, stats] = await Promise.all([
  db.query.matches.findMany({ where, orderBy, limit, offset, columns }),
  db.select({ total: count() }).from(matches).where(whereClause),
  db
    .selectDistinct({ championName: matches.championName })
    .from(matches)
    .where(eq(matches.userId, user.id)),
  db
    .select({ wins: sql<number>`SUM(...)` })
    .from(matches)
    .where(whereClause),
]);
```

Move sequential follow-up queries into the parallel batch when they don't depend on prior results.

### Cache expensive lookups

Use React `cache()` for auth/user lookups called from both layout and page:

```ts
import { cache } from "react";
export const requireUser = cache(async () => {
  /* ... */
});
```

### selectDistinct for filter dropdowns

For populating filter dropdowns (e.g., champion select), use `selectDistinct`:

```ts
const champions = await db
  .selectDistinct({ championName: matches.championName })
  .from(matches)
  .where(eq(matches.userId, user.id));
```

## Security

### Always scope queries by userId

Every DB query in a server action must filter by `userId: user.id` from `requireUser()`. Never trust a userId from client input.

### SQL injection

Drizzle ORM parameterises all queries automatically. When using `sql` tagged template literals, values are parameterised — never use string concatenation or interpolation for user input in SQL.

```typescript
// GOOD — parameterised
sql`${matches.championName} LIKE ${pattern}`;

// BAD — string interpolation (never do this)
sql`champion_name LIKE '${userInput}'`;
```
