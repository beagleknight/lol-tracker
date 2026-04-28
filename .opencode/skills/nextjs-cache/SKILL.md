# Next.js 16 Remote Cache Pattern

## Overview

This skill documents the `"use cache: remote"` caching pattern used in the LevelRise app. It applies to Next.js 16+ deployed on Vercel serverless, using Drizzle ORM with Turso (remote SQLite over HTTP).

## Why "use cache: remote"

- **`"use cache"` (plain) = in-memory LRU** on Vercel serverless. Doesn't persist across cold starts or different instances. Useless for serverless.
- **`"use cache: remote"` = Vercel's distributed Data Cache.** Persists across cold starts, shared across all instances. This is what you want on Vercel.
- Vercel provides the remote cache handler automatically -- no custom `cacheHandlers` config needed.

## Setup

In `next.config.ts`:

```ts
const config: NextConfig = {
  cacheComponents: true, // required to enable "use cache" directives
};
```

## Pattern: Cached Data Fetching

`"use cache: remote"` functions **cannot access cookies/headers** (no `requireUser()`). Each cached function accepts `userId` as an explicit parameter. A thin `"use server"` wrapper resolves the user from the session and delegates.

### Server Action Pattern (e.g., `src/app/actions/duo.ts`)

```ts
"use server";

import { cacheLife, cacheTag } from "next/cache";
import { requireUser } from "@/lib/session";
import { duoTag } from "@/lib/cache";

// Internal cached function -- accepts userId explicitly
async function getCachedDuoStats(userId: string): Promise<DuoStats | null> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(duoTag(userId));

  // ... DB queries using userId ...
}

// Public wrapper -- resolves userId, delegates to cached fn
export async function getDuoStats(): Promise<DuoStats | null> {
  const user = await requireUser();
  return getCachedDuoStats(user.id);
}
```

### Server Component Pattern (e.g., `src/app/(app)/analytics/page.tsx`)

```ts
import { cacheLife, cacheTag } from "next/cache";
import { requireUser } from "@/lib/session";
import { analyticsTag } from "@/lib/cache";

async function getCachedAnalyticsData(userId: string) {
  "use cache: remote";
  cacheLife("hours");
  cacheTag(analyticsTag(userId));

  // ... DB queries ...
  return { allMatches, sessions, ranks, ddragonVersion };
}

export default async function AnalyticsPage() {
  const user = await requireUser();
  const data = await getCachedAnalyticsData(user.id);
  return <AnalyticsClient {...data} />;
}
```

## Cache Lifetimes

| Data type                            | `cacheLife` | Rationale                           |
| ------------------------------------ | ----------- | ----------------------------------- |
| User match/session data              | `"hours"`   | Stale until next sync is acceptable |
| DDragon global data (champions list) | `"days"`    | Changes only on patch day           |

## Cache Tags

Centralized in `src/lib/cache.ts`:

```ts
export const duoTag = (userId: string) => `duo-${userId}`;
export const analyticsTag = (userId: string) => `analytics-${userId}`;
export const coachingTag = (userId: string) => `coaching-${userId}`;
export const scoutTag = (userId: string) => `scout-${userId}`;
```

## Invalidation

### `revalidateTag` requires 2 args in Next.js 16

```ts
revalidateTag(duoTag(userId), "max"); // "max" = stale-while-revalidate
```

The single-arg form `revalidateTag(tag)` is deprecated.

### Invalidation Helpers (in `src/lib/cache.ts`)

| Helper                                | Tags invalidated                | Used by                                       |
| ------------------------------------- | ------------------------------- | --------------------------------------------- |
| `invalidateAllCaches(userId)`         | duo, analytics, coaching, scout | Sync, account link/unlink                     |
| `invalidateReviewCaches(userId)`      | analytics, coaching, scout      | `savePostGameReview`, `bulkMarkReviewed`      |
| `invalidateCoachingCaches(userId)`    | coaching                        | All 8 coaching mutations                      |
| `invalidateDuoCaches(userId)`         | duo                             | `setDuoPartner`, `clearDuoPartner`            |
| `invalidateDuoBackfillCaches(userId)` | duo, analytics, scout           | `backfillDuoGames`, `backfillDuoPartnerStats` |

## What NOT to Cache

- **`getRecentUnreviewedMatch`** -- Has a 2-hour time window check (`Date.now()`). Caching would return stale "recent" results.
- **`detectLiveMatchup`** -- Real-time Riot API call for active game detection.
- **`getDuoPartnerInfo`** -- Fast PK lookup, not worth caching overhead.

## Cache Key Mechanics

Cache keys are derived from **function identity + serialized arguments**. Each `(userId, page)` or `(userId, championName)` combo is a separate cache entry. No manual key management needed.

## Adding a New Cached Function

1. Create an internal `async function getCachedFoo(userId: string, ...)` with `"use cache: remote"` directive
2. Add `cacheLife("hours")` (or `"days"` for global data)
3. Add `cacheTag(fooTag(userId))` using a tag helper from `src/lib/cache.ts`
4. Create a public `export async function getFoo(...)` wrapper that calls `requireUser()` then delegates
5. Add the appropriate `invalidateFooCaches` call to every mutation that affects the data
6. Add a tag helper to `src/lib/cache.ts` if needed

## Files

- `next.config.ts` -- `cacheComponents: true`
- `src/lib/cache.ts` -- Tag helpers + invalidation helpers
- `src/app/actions/duo.ts` -- Cached duo stats/games/synergy
- `src/app/(app)/analytics/page.tsx` -- Cached analytics data
- `src/app/(app)/coaching/page.tsx` -- Cached coaching hub data
- `src/app/actions/live.ts` -- Cached scout data (matchup report, most played, etc.)
- `src/app/api/sync/route.ts` -- Invalidates all caches after sync
- `src/app/actions/matches.ts` -- Invalidates review caches
- `src/app/actions/coaching.ts` -- Invalidates coaching caches
- `src/app/actions/settings.ts` -- Invalidates duo/all caches
