<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:turso-migration-rules -->
# Turso / Drizzle Migration Workflow

When you modify `src/db/schema.ts` (add columns, create tables, change indexes, etc.), the production Turso database will NOT update automatically. **You must run the migration against production before pushing code that references new schema.**

## Steps after any schema change

1. Generate migration: `npx drizzle-kit generate`
2. **Run migration against production Turso**: `npx drizzle-kit migrate` (requires `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env.local`)
3. Verify migration succeeded before pushing code

If `.env.local` doesn't have Turso credentials, pull them with:
```
npx vercel env pull .env.local
```
Note: env vars are scoped to **Production** on Vercel. If `vercel env pull` returns empty values, the user must manually copy `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from the Vercel dashboard into `.env.local`.

## Why this matters

The Vercel deployment auto-builds on push but does NOT run migrations. If new code references columns/tables that don't exist in production yet, every page that touches those columns will return a 500 error.

## Config

- `drizzle.config.ts` reads `TURSO_DATABASE_URL` (defaults to local `file:./data/lol-tracker.db` if unset) and `TURSO_AUTH_TOKEN`
- Migrations live in `drizzle/` directory
- Schema is at `src/db/schema.ts`
<!-- END:turso-migration-rules -->
