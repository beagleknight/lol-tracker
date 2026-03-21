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
export const matches = sqliteTable("matches", {
  // ... columns
}, (table) => [
  index("idx_matches_user_game_date").on(table.userId, table.gameDate),
  index("idx_matches_user_champion").on(table.userId, table.championName),
]);
```

Always add indexes when:
- A page filters by `userId` (every page does in a multi-user app)
- Queries sort by a date/timestamp column
- Queries filter on status, type, or category columns alongside userId

## Migration workflow

1. Modify `src/db/schema.ts`
2. Generate migration: `npx drizzle-kit generate`
3. Review the generated SQL in `drizzle/` directory
4. Apply locally: `npx drizzle-kit push` (or restart dev server)
5. Apply to production: `npx drizzle-kit push` with `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` set

## Data sync (db-push / db-pull)

### Safety rules
- **UPSERT ONLY** — never delete production data
- Use `ON CONFLICT(pk) DO UPDATE SET ...` for natural-key tables
- For auto-increment tables, match on business-meaningful columns (e.g., `[user_id, captured_at]` for rank snapshots) to detect duplicates
- Track ID remappings when auto-increment IDs differ between local and production (e.g., coaching_sessions local id=5 might map to production id=12)
- Junction tables need ID remapping applied to foreign keys before insert
- Always confirm with user before pushing: `--yes` flag to skip confirmation

### Table categories

| Type | Example | PK Strategy | Upsert Strategy |
|------|---------|-------------|-----------------|
| Natural key | users, matches | UUID or Riot ID | `ON CONFLICT(id) DO UPDATE` |
| Auto-increment | rank_snapshots, coaching_sessions | integer autoincrement | Match on business key, insert without ID |
| Junction | coaching_session_matches | composite PK | Remap foreign keys, `INSERT OR IGNORE` |

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
  columns: { /* explicit columns */ },
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

const matchIds = pageMatches.map(m => m.id);
const highlights = matchIds.length > 0
  ? await db.query.matchHighlights.findMany({
      where: and(
        eq(matchHighlights.userId, user.id),
        inArray(matchHighlights.matchId, matchIds),
      ),
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
const userIds = invites.map(i => i.usedBy).filter(Boolean);
const usersMap = userIds.length > 0
  ? Object.fromEntries(
      (await db.query.users.findMany({
        where: inArray(users.id, userIds),
      })).map(u => [u.id, u])
    )
  : {};
```

### Parallelize independent queries

Wrap unrelated queries in `Promise.all`:

```ts
const [rows, countResult, champions, stats] = await Promise.all([
  db.query.matches.findMany({ where, orderBy, limit, offset, columns }),
  db.select({ total: count() }).from(matches).where(whereClause),
  db.selectDistinct({ championName: matches.championName }).from(matches).where(eq(matches.userId, user.id)),
  db.select({ wins: sql<number>`SUM(...)` }).from(matches).where(whereClause),
]);
```

Move sequential follow-up queries into the parallel batch when they don't depend on prior results.

### Cache expensive lookups

Use React `cache()` for auth/user lookups called from both layout and page:

```ts
import { cache } from "react";
export const requireUser = cache(async () => { /* ... */ });
```

### selectDistinct for filter dropdowns

For populating filter dropdowns (e.g., champion select), use `selectDistinct`:

```ts
const champions = await db
  .selectDistinct({ championName: matches.championName })
  .from(matches)
  .where(eq(matches.userId, user.id));
```
