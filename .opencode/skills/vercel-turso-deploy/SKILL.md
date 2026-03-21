---
name: vercel-turso-deploy
description: Deploy Next.js apps to Vercel with Turso (libSQL) database, including dotenvx banner workarounds, region colocation, and env var safety patterns
---

## What I do

Guide deployment and configuration of Next.js applications on Vercel with a Turso (libSQL) database backend. This includes env var safety, region colocation, and runtime pitfalls specific to this stack.

## When to use me

- Deploying or reconfiguring Vercel settings
- Adding or rotating environment variables on Vercel
- Debugging env var corruption or unexpected runtime behavior on Vercel
- Colocating Vercel functions with a Turso database region
- Troubleshooting cold start or latency issues

## Critical pitfalls

### dotenvx v17 banner corruption

Vercel's runtime (when using dotenvx or dotenv v17+) prepends a banner to ALL `process.env` values:

```
[dotenv@17.3.1] injecting env (6) from .env.local -- tip: ...\n<actual value>
```

This corrupts every env var read at both runtime and module evaluation time.

**Fix**: Create `src/instrumentation.ts` (Next.js instrumentation hook) that strips the banner at server startup:

```ts
export function register() {
  const bannerPattern = /^\[dotenv@[^\]]+\][^\n]*\n/;
  for (const key of Object.keys(process.env)) {
    const value = process.env[key];
    if (value && bannerPattern.test(value)) {
      process.env[key] = value.replace(bannerPattern, "");
    }
  }
}
```

### Static process.env reads at module scope

Any code that reads `process.env.SOME_VAR` at module evaluation time (top-level `const`, default export objects) gets the corrupted value on Vercel. The banner is stripped by `instrumentation.ts`, but only AFTER modules are loaded.

**Fix pattern**: Always defer env var reads to request time:
- Use lazy init via Proxy (see `src/db/index.ts`)
- Use getter functions: `function getApiKey() { return process.env.API_KEY!; }`
- Use framework conventions (Auth.js auto-reads `AUTH_*` vars at request time)

**Never do this**:
```ts
// BAD — reads at module load time, before instrumentation runs
const client = createClient({ url: process.env.TURSO_DATABASE_URL! });
export const db = drizzle(client);
```

**Do this instead**:
```ts
// GOOD — lazy Proxy defers creation to first access (at request time)
let database: LibSQLDatabase | undefined;
export const db = new Proxy({} as LibSQLDatabase, {
  get(_target, prop, receiver) {
    if (!database) {
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL ?? "file:./data/lol-tracker.db",
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      database = drizzle(client, { schema });
    }
    return Reflect.get(database, prop, receiver);
  },
});
```

### echo adds trailing newlines to env vars

When setting env vars via CLI:

```bash
# BAD — echo adds \n, corrupting OAuth secrets
echo "my-secret" | npx vercel env add AUTH_DISCORD_SECRET production

# GOOD — printf does not add trailing newline
printf "my-secret" | npx vercel env add AUTH_DISCORD_SECRET production
```

### Region colocation

Vercel defaults to `iad1` (US East). If your Turso DB is in a different region (e.g., `aws-eu-west-1` / Ireland), every DB query crosses the Atlantic.

**Fix**: Set `"regions"` in `vercel.json` to match your Turso region:

```json
{
  "regions": ["dub1"]
}
```

Common Turso-to-Vercel region mappings:
- `aws-eu-west-1` (Ireland) -> `"dub1"` (Dublin)
- `aws-us-east-1` (Virginia) -> `"iad1"` (Washington DC)
- `aws-us-west-2` (Oregon) -> `"pdx1"` (Portland)

### Build command

If using Turbopack for dev but webpack for production builds:

```json
{
  "buildCommand": "next build --webpack",
  "regions": ["dub1"]
}
```

## Environment variables checklist

Required env vars for this stack:
- `TURSO_DATABASE_URL` — Turso database URL (e.g., `libsql://mydb-myorg.turso.io`)
- `TURSO_AUTH_TOKEN` — Turso auth token
- `AUTH_SECRET` — NextAuth.js secret (generate with `npx auth secret`)
- `AUTH_DISCORD_ID` — Discord OAuth client ID (Auth.js naming convention)
- `AUTH_DISCORD_SECRET` — Discord OAuth client secret
- `AUTH_TRUST_HOST=true` — Required for Auth.js on Vercel
- Any app-specific API keys (e.g., `RIOT_API_KEY`)

## Data sync scripts

Use `npm run db:pull` (production -> local) and `npm run db:push` (local -> production).

**db:push safety**: Upsert-only. Never deletes production data. Uses `ON CONFLICT DO UPDATE` for natural-key tables and business-key matching for auto-increment tables. Always confirm before pushing.

## Turso / Drizzle migration workflow

When you modify `src/db/schema.ts` (add columns, create tables, change indexes, etc.), the production Turso database will NOT update automatically. **You must run the migration against production before pushing code that references new schema.**

### Steps after any schema change

1. Generate migration: `npx drizzle-kit generate`
2. Review the generated SQL in `drizzle/XXXX_*.sql`
3. **Apply migration against production Turso**: Create a standalone script (see "`drizzle-kit migrate` fails or hangs with dotenvx" section below) and run it via `npx @dotenvx/dotenvx run --env-file=.env.local -- npx tsx scripts/apply-migration-XXXX.ts`
4. Verify migration succeeded (e.g., `PRAGMA table_info(tablename)`) before pushing code

### `drizzle-kit migrate` fails or hangs with dotenvx

`drizzle-kit migrate` reads `drizzle.config.ts` at module scope, which means env vars are consumed **before** any banner-stripping can run. When invoked via `npx @dotenvx/dotenvx run --env-file=.env.local -- npx drizzle-kit migrate`, the `TURSO_DATABASE_URL` value is corrupted by the dotenvx banner and the command fails silently or with a cryptic error.

**Workaround**: Write a standalone `.ts` migration script that strips the banner itself, then run it with `npx tsx`. See `scripts/apply-migration-0006.ts` for an example. The pattern:

```ts
// scripts/apply-migration-XXXX.ts
import { createClient } from "@libsql/client";

function cleanEnv(key: string): string | undefined {
  const val = process.env[key];
  if (!val) return undefined;
  return val.replace(/^\[dotenv@[^\]]+\][^\n]*\n/, "");
}

const db = createClient({
  url: cleanEnv("TURSO_DATABASE_URL")!,
  authToken: cleanEnv("TURSO_AUTH_TOKEN"),
});

async function run() {
  // Copy statements from the generated drizzle/XXXX_*.sql file:
  await db.execute("ALTER TABLE `matches` ADD `new_column` text");
  console.log("Done!");
}
run().catch(console.error);
```

Run with:
```bash
npx @dotenvx/dotenvx run --env-file=.env.local -- npx tsx scripts/apply-migration-XXXX.ts
```

**Important**: Do NOT use `node --env-file` with `require('@libsql/client')` — `@libsql/client` is ESM-only and won't work with `require()`.

After applying manually, the drizzle `__drizzle_migrations` table in Turso will be out of sync with the applied state. This is acceptable for this project since migrations are applied manually anyway. If needed, you can insert a record into `__drizzle_migrations` to mark it as applied.

### If `.env.local` doesn't have Turso credentials

Pull them with:
```bash
npx vercel env pull .env.local
```
Note: env vars are scoped to **Production** on Vercel. If `vercel env pull` returns empty values, manually copy `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from the Vercel dashboard into `.env.local`.

### Why this matters

The Vercel deployment auto-builds on push but does NOT run migrations. If new code references columns/tables that don't exist in production yet, every page that touches those columns will return a 500 error.

### Config

- `drizzle.config.ts` reads `TURSO_DATABASE_URL` (defaults to local `file:./data/lol-tracker.db` if unset) and `TURSO_AUTH_TOKEN`
- Migrations live in `drizzle/` directory
- Schema is at `src/db/schema.ts`
