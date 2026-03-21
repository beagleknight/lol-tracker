---
name: drizzle-schema
description: Drizzle ORM schema management with Turso/libSQL, migrations, indexes, and safe upsert-only data sync patterns
---

## What I do

Guide Drizzle ORM schema design, migration workflows, index optimization, and data synchronization between local SQLite and production Turso databases.

## When to use me

- Adding or modifying database tables/columns
- Creating or reviewing database indexes
- Running migrations with `drizzle-kit`
- Syncing data between local development and production
- Optimizing query performance with proper indexing

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

- **Exclude large columns on list pages**: Don't SELECT `rawMatchJson` (50-100KB per row) unless on a detail page
- **Use SQL aggregates for dashboards**: `COUNT(*)`, `SUM(CASE WHEN ...)` instead of fetching all rows and counting in JS
- **Parallelize independent queries**: Wrap in `Promise.all([query1, query2, ...])`
- **Cache expensive lookups**: Use React `cache()` for auth/user lookups called from both layout and page
