# LoL Tracker — TODO

## Untested Flows (code exists, needs browser verification)
- [ ] Coaching session creation flow (create session, link matches, add action items)
- [ ] Coaching session detail (view session, cycle action item statuses, delete session)
- [ ] Action items page (filtering by status/topic, status cycling, delete)
- [ ] CSV import with actual file upload and data import
- [ ] Inline comment editing on matches page (Add Comment button in table)
- [ ] Inline review editing on matches page (Review button in table)
- [ ] Match detail: save game notes and VOD review notes
- [ ] Invite system: test full flow (new user with invite code, reject without code)
- [ ] Admin settings: generate/copy/delete invite codes
- [ ] Admin settings: API key status check
- [ ] Auth proxy: verify redirect-to-login flow with Auth.js wrapper

## Polish
- [x] Add loading states with Suspense boundaries and skeleton components
- [x] Add error boundaries for graceful error handling
- [x] Add toast notifications (Sonner) for success/error feedback on all actions
- [x] Add champion avatars everywhere (champion stats, matchup labels, filters, game pickers)
- [ ] Responsive refinements (mobile experience for tables, forms, etc.)
- [ ] Empty states with illustrations/helpful messages (no matches yet, no coaching sessions, etc.)

## Features — LP Tracking
- [ ] Capture LP before/after each game during sync (requires comparing rank snapshots)
- [ ] Add LP gain/loss column to matches table
- [x] Add LP graph to dashboard and/or analytics page
- [ ] Show promotion/demotion markers on LP graph

## Features — Deployment
- [x] Swap better-sqlite3 for @libsql/client (Turso-ready)
- [x] Invite-only auth system (role column, invites table, invite-gated signIn)
- [x] Auth proxy upgrade (Auth.js `auth()` wrapper replaces cookie-sniffing)
- [x] Riot API key health check (admin settings page)
- [x] Export RiotApiError + handle 401 alongside 403
- [x] AUTH_TRUST_HOST in .env.example
- [x] Deploy to Vercel + Turso (manual step)
- [x] Set up Turso production database and import local data (db-push/db-pull scripts)
- [ ] Wire up `src/proxy.ts` as proper Next.js middleware (defense-in-depth auth guard)
- [ ] Add smoke tests (build check, key routes return 200) and run them before auto-deploy

## Features — Future Enhancements
- [ ] Riot RSO authentication (Phase 2 — requires Production API key from Riot)
- [ ] Auto-sync on login or on a schedule (instead of manual "Sync Games" button)
- [ ] Export data (CSV export of matches with all fields)
- [ ] Multi-account support (track games across multiple Riot accounts)
- [ ] Matchup-specific notes (per champion matchup, not just per game)
- [ ] Goal setting (e.g., "reach Diamond by end of split") with progress tracking

## Features — Duo Partner Tracking & Synergy
- [ ] Add duo partners: settings page to register duo partners by Riot ID (gameName#tagLine)
- [ ] Auto-detect duo games: parse rawMatchJson to find games where a registered duo partner was on your team
- [ ] Per-duo dashboard: win rate together, games played, average combined KDA, best/worst champion combos
- [ ] Champion synergy matrix: which champion pairs (yours + duo's) have the highest win rate together
- [ ] Duo vs solo comparison: show how your stats differ when playing with each duo partner vs solo queue
- [ ] Per-match duo indicator: tag matches in the match list with the duo partner's name/champion when detected
- [ ] Duo-specific analytics: lane proximity, shared kills/assists, how often you die together vs separately
- [ ] Data source: rawMatchJson already contains all 10 players per game — extract duo partner's participantId to pull their stats (champion, KDA, items, role, lane)

## Features — Ascent VOD Integration
- [ ] Scrape user's Ascent profile to pull VOD links (no known public API — web scraping or headless browser needed)
- [ ] Auto-match Ascent VODs to synced games by game timestamp or Riot match ID
- [ ] Store VOD URL per match in the database (new column or separate table)
- [ ] Show VOD link on match detail page and match list cards (one-click to watch)
- [ ] If scraping isn't reliable, fall back to manual Ascent URL input per match
- [ ] Investigate whether Ascent exposes any undocumented API endpoints (network tab inspection)

## Features — AI-Powered Coaching Assistant
- [ ] AI-driven post-game analysis: summarize key mistakes and strengths from match data (KDA, CS, vision, gold, game duration, runes, matchup) and user-written notes
- [ ] Personalized improvement plan: use match history trends + coaching session notes + action items to generate a prioritized list of things to work on
- [ ] Pattern detection: identify recurring mistakes across games (e.g., "you die 2+ times before 10 min in 60% of losses", "your CS/min drops significantly in losing matchups vs assassins")
- [ ] Coaching session prep: before a session, generate a summary of recent performance, progress on action items, and suggested discussion topics
- [ ] Matchup advice: given a champion + matchup, surface relevant notes from past games, win rate context, and general tips
- [ ] Review queue assistant: for unreviewed games, generate guided review prompts based on the match data (e.g., "You had 12 deaths this game — what fights could you have avoided?")
- [ ] Goal tracking insights: if goals are set, provide periodic AI check-ins on progress with actionable suggestions
- [ ] Data sources to feed the AI: match stats, raw match JSON (detailed player data), game notes, review notes, coaching session notes, action items, rank progression, champion/rune/matchup stats

## Developer Experience — OpenCode Skills
- [x] Create `vercel-turso-deploy` skill (Vercel + Turso deployment, dotenvx workarounds, region config)
- [x] Create `drizzle-schema` skill (schema management, migrations, upsert-only db-push)
- [x] Create `riot-api` skill (Riot API client patterns, rate limits, DDragon, RSO auth)
- [x] Create `nextjs-auth` skill (Auth.js v5 with Discord, invite-only system, env var conventions)

## Discovered Pitfalls (reference)
- **dotenvx v17 banner corruption**: Vercel runtime prepends a banner to ALL `process.env` values. Fixed with `instrumentation.ts` that strips banners at server startup.
- **Static `process.env` reads at module scope**: Any code reading env vars at import time gets corrupted values on Vercel. Always defer to request time.
- **Auth.js `AUTH_<PROVIDER>_ID` convention**: Auth.js auto-reads `AUTH_DISCORD_ID` / `AUTH_DISCORD_SECRET`. Don't pass explicit `clientId`/`clientSecret`.
- **`echo` adds trailing newlines**: Use `printf` when piping values to `npx vercel env add`.
- **Vercel defaults to `iad1` (US East)**: Set `"regions": ["dub1"]` in `vercel.json` to colocate with Turso in Ireland.
- **Discord `prompt=consent`**: Auth.js default forces re-authorization every login. Fix: `{ authorization: { params: { prompt: "none" } } }`.

## Known Limitations
- Riot API personal key expires every 24h — need to refresh at https://developer.riotgames.com/
- Rate limits: 20 req/sec, 100 req/2min — sufficient for personal use but sync is sequential
- Imported CSV games have synthetic match IDs (prefixed `IMPORT_`) and no raw match JSON
- Match detail page won't show full player data for imported games
- First user auto-promoted to admin; subsequent users need an invite code
