---
name: riot-api
description: Riot Games API integration patterns for League of Legends, including account lookup, match history, ranked data, DDragon assets, rate limits, and error handling
---

## What I do

Guide integration with the Riot Games API for League of Legends applications, covering authentication, endpoint routing, match data parsing, static assets from DDragon, and rate limit management.

## When to use me

- Adding new Riot API endpoints or data fetching
- Parsing match JSON data (participants, items, runes, timeline)
- Working with DDragon static assets (champion icons, item images, rune images)
- Debugging Riot API errors (401, 403, 429, 404)
- Planning features that depend on Riot data (LP tracking, duo detection, matchup analysis)

## API key management

### Personal API Key

- Non-expiring personal key from https://developer.riotgames.com/
- Store as `RIOT_API_KEY` env var

### Production key (RSO)

- Requires Riot Sign On (RSO) application approval
- Persistent, does not expire
- Much higher rate limits

### Deferred env var read

Never read `RIOT_API_KEY` at module scope (see `vercel-turso-deploy` skill for why):

```ts
// GOOD — deferred read
function getRiotApiKey(): string {
  return process.env.RIOT_API_KEY!;
}

// BAD — module-scope read, gets corrupted on Vercel
const API_KEY = process.env.RIOT_API_KEY!;
```

## API routing

Riot has two routing levels. Use the correct host for each endpoint.

### Regional routing (broad geography)

- `americas.api.riotgames.com` — NA, BR, LAN, LAS, OCE
- `europe.api.riotgames.com` — EUW, EUNE, TR, RU
- `asia.api.riotgames.com` — KR, JP
- `sea.api.riotgames.com` — PH, SG, TH, TW, VN

Used for: `account-v1`, `match-v5` (match history + match detail)

### Platform routing (specific server)

- `euw1.api.riotgames.com` — EUW
- `na1.api.riotgames.com` — NA
- `kr.api.riotgames.com` — KR
- etc.

Used for: `summoner-v4`, `league-v4` (ranked data), `spectator-v5`

## Key endpoints

### Account lookup (by Riot ID)

```
GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}
Host: {regional}
Returns: { puuid, gameName, tagLine }
```

### Summoner (by PUUID)

```
GET /lol/summoner/v4/summoners/by-puuid/{puuid}
Host: {platform}
Returns: { puuid, profileIconId, revisionDate, summonerLevel }
```

**NOTE (2026):** This endpoint no longer returns `id` (encrypted summoner ID) or `accountId`. Only 4 fields are returned. Do NOT rely on `summoner.id` for League-V4 lookups — use the by-puuid League endpoint instead.

### Ranked data (by PUUID — preferred)

```
GET /lol/league/v4/entries/by-puuid/{encryptedPUUID}
Host: {platform}
Returns: Array of { queueType, tier, rank, leaguePoints, wins, losses, summonerId, leagueId }
```

Filter for `queueType === "RANKED_SOLO_5x5"` for solo queue. This is the **preferred** endpoint since it uses puuid directly.

### Ranked data (by summoner ID — legacy)

```
GET /lol/league/v4/entries/by-summoner/{encryptedSummonerId}
Host: {platform}
Returns: Array of { queueType, tier, rank, leaguePoints, wins, losses }
```

Filter for `queueType === "RANKED_SOLO_5x5"` for solo queue.
**NOTE:** Since Summoner-V4 no longer returns `id`, obtaining an encrypted summoner ID requires an extra step. Prefer the by-puuid endpoint above.

### Match history (list of match IDs)

```
GET /lol/match/v5/matches/by-puuid/{puuid}/ids?start=0&count=20&type=ranked
Host: {regional}
Returns: string[] of match IDs (e.g., ["EUW1_7234567890", ...])
```

Max `count`: 100. Use `start` for pagination.

### Match detail

```
GET /lol/match/v5/matches/{matchId}
Host: {regional}
Returns: { metadata, info: { participants[], teams[], gameDuration, ... } }
```

## Match data parsing

### Find the player's participant

```ts
const participant = match.info.participants.find((p) => p.puuid === userPuuid);
```

### Key participant fields

- `championId`, `championName` — champion played
- `kills`, `deaths`, `assists` — KDA
- `totalMinionsKilled + neutralMinionsKilled` — total CS
- `gameDuration` (seconds) — for CS/min calculation
- `win` — boolean
- `individualPosition` / `teamPosition` — lane/role ("TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY")
- `perks.styles[0].selections[0].perk` — keystone rune ID
- `item0`-`item6` — item IDs (item6 is trinket)
- `goldEarned`, `visionScore`, `wardsPlaced`, `wardsKilled`
- `totalDamageDealtToChampions`, `totalDamageTaken`

### Detect opponent (matchup champion)

Find the enemy in the same lane:

```ts
const opponent = match.info.participants.find(
  (p) => p.teamId !== participant.teamId && p.individualPosition === participant.individualPosition,
);
const matchupChampion = opponent?.championName;
```

### Detect duo partner

Check if a registered duo partner's PUUID is in the match participants on the same team:

```ts
const isDuo = match.info.participants.some(
  (p) => p.puuid === duoPartnerPuuid && p.teamId === participant.teamId,
);
```

## DDragon (static assets)

Base URL pattern:

```
https://ddragon.leagueoflegends.com/cdn/{version}/img/{type}/{name}
```

### Version discovery

```
GET https://ddragon.leagueoflegends.com/api/versions.json
Returns: string[] — use [0] for latest
```

### Caching DDragon data

DDragon version and champion data change only on game patches (~every 2 weeks). Cache with Next.js fetch:

```ts
const res = await fetch("https://ddragon.leagueoflegends.com/api/versions.json", {
  next: { revalidate: 86400 }, // 24-hour cache
});
```

Apply the same `{ next: { revalidate: 86400 } }` to all DDragon fetches (versions, champion JSON, etc.). This avoids redundant external API calls on every page load.

### Champion icons

```
https://ddragon.leagueoflegends.com/cdn/{version}/img/champion/{championName}.png
```

Note: `championName` must match DDragon naming (e.g., "FiddleSticks" not "Fiddlesticks", "MonkeyKing" not "Wukong").

### Item icons

```
https://ddragon.leagueoflegends.com/cdn/{version}/img/item/{itemId}.png
```

### Profile icons

```
https://ddragon.leagueoflegends.com/cdn/{version}/img/profileicon/{profileIconId}.png
```

## Rate limits

### Development key

- 20 requests per second
- 100 requests per 2 minutes

### Handling rate limits

- Check for HTTP 429 responses
- Read `Retry-After` header for backoff duration
- Sequential sync is fine for personal use but add delays between batch requests

## Error handling

```ts
export class RiotApiError extends Error {
  constructor(
    public status: number,
    public endpoint: string,
    message: string,
  ) {
    super(message);
  }
}
```

Key status codes:

- **401/403**: API key is invalid or unauthorized.
- **404**: Summoner/account not found (likely wrong region or misspelled Riot ID)
- **429**: Rate limited. Respect `Retry-After` header.
- **503**: Riot API temporarily unavailable

## Stored data

The `rawMatchJson` column stores the full Riot match detail response (50-100KB per match, avg ~75KB). This is useful for:

- Extracting new data fields later without re-fetching from Riot
- Duo partner detection (all 10 participants are stored)
- Detailed post-game analysis

### Performance rules for rawMatchJson

1. **Never SELECT it on list pages** — use explicit `columns` in Drizzle queries to exclude it. 95 matches x 75KB = 7MB of unnecessary data transfer.
2. **Only SELECT it on detail pages** — where you need the full participant data for a single match.
3. **When passing to client components, extract slim data** — don't send the full 75KB JSON as a prop. Extract only the fields the client needs (e.g., participant stats, items, runes) server-side, reducing the RSC payload from ~75KB to ~2KB.
4. **Exclude from processing queries** — if a feature reads matches for processing (not display), it likely doesn't need rawMatchJson either.

See `nextjs-performance` skill for the full server-side data extraction pattern.

## Security

### Error sanitization

`RiotApiError` has a `userMessage` getter that maps status codes to safe user-facing messages. Never expose raw Riot API errors, status codes, or response bodies to the client.

```typescript
catch (err) {
  if (err instanceof RiotApiError) {
    return { error: err.userMessage };  // safe for client
  }
  return { error: "An unexpected error occurred." };
}
```

### API key protection

- `RIOT_API_KEY` is server-only — never expose in client bundles or CSP
- The key is only read in `src/lib/riot-api.ts` server-side functions
- All Riot data flows: server action/route → DB → client component (never direct client→Riot)
