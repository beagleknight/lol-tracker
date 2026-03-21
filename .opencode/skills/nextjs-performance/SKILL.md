---
name: nextjs-performance
description: Performance optimization for Next.js apps on Vercel free tier with Turso — server-side pagination, RSC payload reduction, query batching, loading states, and resource-conscious patterns
---

## What I do

Guide performance optimization for Next.js applications deployed on Vercel (free tier) with Turso (free tier), focusing on minimizing data transfer, database row reads, RSC payload size, and perceived latency.

## When to use me

- A page loads slowly or transfers too much data
- Converting client-side pagination/filtering to server-side
- Reducing RSC (React Server Component) payload size
- Adding loading feedback for server-navigated pages
- Optimizing database queries to reduce Turso row reads (free tier limit)
- Auditing a page for unnecessary data fetching

## Principles

1. **Only fetch what the user sees** — LIMIT/OFFSET on the server, not fetch-all-then-slice on the client
2. **Only SELECT columns you need** — exclude large columns (especially JSON blobs) from list queries
3. **Only pass what the client needs** — extract slim data from large objects before passing to client components
4. **Parallelize independent queries** — `Promise.all()` for queries that don't depend on each other
5. **Show loading feedback** — `useTransition` for navigation, Suspense skeletons for initial load

## Anti-patterns to watch for

### Fetch-all + client-side pagination

```tsx
// BAD — fetches ALL rows, sends them all in RSC payload, paginates in JS
const allMatches = await db.query.matches.findMany({ where: eq(matches.userId, user.id) });
// Client: const page = paginate(allMatches, currentPage);
```

This sends the entire dataset to the client on every page load. As data grows, the RSC payload grows linearly.

### Selecting large columns on list pages

```tsx
// BAD — rawMatchJson is 50-100KB per row, multiplied by every row fetched
const matches = await db.query.matches.findMany({
  where: eq(matches.userId, user.id),
});
```

Always use explicit `columns` to exclude large fields:

```tsx
// GOOD — explicit column selection, rawMatchJson excluded
const matches = await db.query.matches.findMany({
  where: eq(matches.userId, user.id),
  columns: {
    id: true,
    championName: true,
    result: true,
    kills: true,
    deaths: true,
    assists: true,
    // ... only the fields needed for display
    // rawMatchJson: NOT included
  },
});
```

### Passing full API responses to client components

```tsx
// BAD — 75KB rawMatchJson sent as RSC prop
<MatchDetailClient rawMatch={JSON.parse(match.rawMatchJson)} />
```

Extract only what the client needs:

```tsx
// GOOD — extract ~2KB of relevant data server-side
const participants = rawMatch.info.participants.map(p => ({
  puuid: p.puuid,
  championName: p.championName,
  kills: p.kills,
  deaths: p.deaths,
  assists: p.assists,
}));
<MatchDetailClient participants={participants} />
```

### Fetching related data for ALL rows instead of the current page

```tsx
// BAD — fetches highlights for ALL user matches
const allHighlights = await db.query.matchHighlights.findMany({
  where: eq(matchHighlights.userId, user.id),
});

// GOOD — fetch highlights only for the 10 matches on this page
const matchIds = pageMatches.map(m => m.id);
const pageHighlights = matchIds.length > 0
  ? await db.query.matchHighlights.findMany({
      where: and(
        eq(matchHighlights.userId, user.id),
        inArray(matchHighlights.matchId, matchIds),
      ),
    })
  : [];
```

### N+1 queries for related data

```tsx
// BAD — one query per item
for (const invite of invites) {
  const user = await db.query.users.findFirst({ where: eq(users.id, invite.usedBy) });
}

// GOOD — batch lookup
const userIds = invites.map(i => i.usedBy).filter(Boolean);
const usersMap = userIds.length > 0
  ? Object.fromEntries(
      (await db.query.users.findMany({
        where: inArray(users.id, userIds),
      })).map(u => [u.id, u])
    )
  : {};
```

## Server-side pagination pattern

### Page component (RSC)

Accept `searchParams` as a Promise (Next.js 16), parse filters, build WHERE clause, run paginated query:

```tsx
const PAGE_SIZE = 10;

export default async function ListPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const page = Math.max(1, parseInt(String(params.page ?? "1"), 10) || 1);
  const search = typeof params.search === "string" ? params.search : "";
  // ... parse other filters

  // Build dynamic WHERE conditions
  const conditions = [eq(table.userId, user.id)];
  if (search) {
    const pattern = `%${search}%`;
    conditions.push(sql`${table.name} LIKE ${pattern}`);
  }
  const whereClause = and(...conditions);
  const offset = (page - 1) * PAGE_SIZE;

  // Run all queries in parallel
  const [rows, countResult, statsResult] = await Promise.all([
    db.query.table.findMany({
      where: whereClause,
      orderBy: desc(table.createdAt),
      limit: PAGE_SIZE,
      offset,
      columns: { /* only needed columns */ },
    }),
    db.select({ total: count() }).from(table).where(whereClause),
    db.select({
      wins: sql<number>`SUM(CASE WHEN ${table.result} = 'Victory' THEN 1 ELSE 0 END)`,
    }).from(table).where(whereClause),
  ]);

  const totalPages = Math.max(1, Math.ceil(countResult[0].total / PAGE_SIZE));

  return (
    <ListClient
      rows={rows}
      currentPage={Math.min(page, totalPages)}
      totalPages={totalPages}
      filters={{ search }}
    />
  );
}
```

Key points:
- `db.query.*.findMany()` supports `offset` at the root level (not in nested `with`)
- `count()` from `drizzle-orm` for total count
- `sql` template for LIKE search and aggregate stats
- `Math.min(page, totalPages)` clamps out-of-bounds pages

### Client component — URL-based navigation

Filters navigate via URL search params instead of local state:

```tsx
"use client";

function buildUrl(params: Record<string, string>, overrides: Record<string, string>): string {
  const merged = { ...params, ...overrides };
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (key === "page" && value === "1") continue;     // omit defaults
    if (key === "search" && value === "") continue;
    if (value) sp.set(key, value);
  }
  const qs = sp.toString();
  return `/path${qs ? `?${qs}` : ""}`;
}

export function ListClient({ rows, currentPage, totalPages, filters }) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();

  function navigateWithFilter(key: string, value: string) {
    const url = buildUrl(currentParams, { [key]: value, page: "1" });
    startTransition(() => {
      router.push(url, { scroll: false });
    });
  }
  // ...
}
```

### Debounced search input

Use `useRef` for the timeout to avoid stale closure bugs:

```tsx
const [searchValue, setSearchValue] = useState(filters.search);
const searchTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
const debouncedSearch = useCallback(
  (value: string) => {
    clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      navigateWithFilter("search", value);
    }, 400);
  },
  [/* deps that affect navigation URL */]
);
```

**Do NOT** use `useCallback` with an IIFE to create a debounce closure — it breaks because the inner function captures stale component scope.

## Loading feedback for server navigation

### Problem

When navigating between pages via `router.push()`, the server re-renders but the client shows no feedback. `loading.tsx` only triggers on initial hard navigation, not soft navigations within the same route segment.

### Solution: useTransition

Wrap `router.push()` in `startTransition` to get a pending state:

```tsx
const [isNavigating, startTransition] = useTransition();

function navigateToPage(page: number) {
  startTransition(() => {
    router.push(buildUrl({ page: String(page) }), { scroll: false });
  });
}
```

Use `isNavigating` to:
1. **Dim the content** — opacity transition on the list container
2. **Show a spinner** — overlay centered on the dimmed content
3. **Disable controls** — prevent double-clicks on pagination buttons

```tsx
<div className="relative">
  {isNavigating && (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 rounded-lg">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )}
  <div className={`space-y-2 transition-opacity duration-150 ${isNavigating ? "opacity-40" : ""}`}>
    {items.map(item => <ItemCard key={item.id} item={item} />)}
  </div>
</div>
```

### When to use what

| Scenario | Mechanism | Feedback |
|----------|-----------|----------|
| Initial page load / hard navigation | `loading.tsx` + Suspense | Full skeleton |
| Soft navigation (pagination, filters) | `useTransition` + `router.push()` | Dim + spinner overlay |
| Data mutation (save, delete) | `useTransition` + server action | Button spinner + disabled |

## Caching static external data

For data that rarely changes (e.g., DDragon version, champion data), use Next.js fetch caching:

```ts
const res = await fetch(url, {
  next: { revalidate: 86400 }, // Cache for 24 hours
});
```

This avoids re-fetching on every page load and reduces external API calls. Particularly important for DDragon data which changes only on game patches (~every 2 weeks).

## Vercel + Turso free tier awareness

### Turso free tier limits
- 9 GB storage, 500 databases
- 24 billion row reads / month (soft limit)
- Rows read = every row the query engine touches (including index scans)

### Reducing row reads
- LIMIT/OFFSET pagination: only 10 rows read per page instead of all rows
- Filtered COUNT queries: `SELECT COUNT(*) WHERE ...` reads fewer rows than fetching all and counting in JS
- `inArray()` for related data: fetch highlights for 10 match IDs instead of all user highlights
- Proper indexes: ensure WHERE + ORDER BY columns are indexed so the engine doesn't full-scan

### Vercel free tier limits
- Serverless function execution: 100 GB-hours / month
- Edge function invocations: 500,000 / month
- Bandwidth: 100 GB / month

### Reducing bandwidth
- Smaller RSC payloads = less bandwidth per page view
- Exclude large columns = less data serialized and transferred
- Server-side pagination = 10 items per response instead of all items

## Checklist for auditing a slow page

1. Is the page fetching ALL rows? Add LIMIT/OFFSET with server-side pagination
2. Is `rawMatchJson` (or similar large column) being SELECTed? Exclude it with explicit `columns`
3. Are large objects being passed as props to client components? Extract slim data server-side
4. Are related rows being fetched for ALL items or just the visible page? Use `inArray()` scoping
5. Are there N+1 queries? Batch with `inArray()` and build a map
6. Are independent queries running sequentially? Wrap in `Promise.all()`
7. Is there loading feedback during page transitions? Add `useTransition` with dim + spinner
8. Are external API responses being cached? Add `next: { revalidate }` to fetch calls
9. Are the right indexes in place? Check WHERE + ORDER BY columns are covered
