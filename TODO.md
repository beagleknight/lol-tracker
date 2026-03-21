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
- [ ] Cross-page linking audit: add clickable links throughout the app so users can navigate between related views seamlessly. Examples:
  - Analytics page: click a champion name (yours or opponent) in matchup stats to jump to the Matchup Scout with that champion pre-selected
  - Dashboard: click a champion in recent games or top champions to go to Scout or Analytics filtered for that champion
  - Match detail: click enemy champion to open Scout for that matchup
  - Duo page: click a champion combo in synergy table to navigate to relevant Scout/Analytics views
  - Match list: click champion icons/names to navigate to filtered views
  - General: anywhere a champion name or matchup appears, it should be a link to a relevant deeper view

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
- [x] Add duo partners: settings page to register duo partners (select from registered users with linked Riot accounts)
- [x] Auto-detect duo games: parse rawMatchJson to find games where a registered duo partner was on your team
- [x] Per-duo dashboard: win rate together, games played, average combined KDA, best/worst champion combos
- [x] Champion synergy matrix: which champion pairs (yours + duo's) have the highest win rate together
- [x] Duo vs solo comparison: show how your stats differ when playing with each duo partner vs solo queue
- [x] Per-match duo indicator: tag matches in the match list with duo icon, highlight partner in match detail
- [ ] Duo-specific analytics: lane proximity, shared kills/assists, how often you die together vs separately
- [x] Data source: rawMatchJson parsing for duo partner detection and stats extraction

## Features — Ascent VOD Integration
- [ ] Scrape user's Ascent profile to pull VOD links (no known public API — web scraping or headless browser needed)
- [ ] Auto-match Ascent VODs to synced games by game timestamp or Riot match ID
- [x] Store VOD URL per match in the database (`vodUrl` column on matches table)
- [x] Show VOD link on match detail page and match list cards (one-click to watch)
- [ ] If scraping isn't reliable, fall back to manual Ascent URL input per match
- [ ] Investigate whether Ascent exposes any undocumented API endpoints (network tab inspection)

## Features — Structured Review System (Highlights / Lowlights)
- [x] Shared topics constant (`src/lib/topics.ts`) — `PREDEFINED_TOPICS` + `SKIP_REVIEW_REASONS`
- [x] DB schema: `match_highlights` table + `reviewSkippedReason`/`vodUrl` columns on matches
- [x] Migration: `drizzle/0004_abnormal_alex_wilder.sql`
- [x] Server actions: `saveMatchHighlights`, `getMatchHighlights`, `savePostGameReview`, `updateMatchVodUrl`
- [x] Reusable `HighlightsEditor` + `HighlightsDisplay` components
- [x] PostGameReviewCard (Scout page) — highlights/lowlights first, collapsible notes, VOD input, skip VOD
- [x] Scouting Report "Your Notes" — shows `HighlightsDisplay` for past matchup games
- [x] ReviewCard (Review Queue) — highlights editor, collapsible comments, VOD link, skip VOD
- [x] Match detail page — highlights card, VOD link with save, skip VOD button
- [x] Matches list — highlight/lowlight count indicators on collapsed cards
- [x] Coaching session creation — single match picker with highlight/VOD preview
- [x] Coaching session detail — linked match highlights/lowlights + VOD link display

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

## Review — Matchup Scout
- [x] Review matchup scout page — not working as intended
- [x] Bug: live game detected correctly but matchup was NOT auto-assigned — fixed: now shows enemy team as quick-select buttons, auto-sets your champion
- [x] Investigate: should the scout still show the matchup even without historical data? — fixed: shows "no past games" message with helpful hint
- [x] Investigate and document what else might be broken (data fetching, display, filtering, etc.)
- [x] Consider filtering by YOUR champion too (not just the enemy matchup) — added: two comboboxes, your champion filters the report
- [x] UI: two champion selectors side by side (your champion vs enemy champion) with searchable dropdowns — implemented with cmdk combobox
- [x] Fix identified issues — SELECT DISTINCT for matchup query, revalidatePath for scout, reviewed field check

## Known Limitations
- Riot API personal key expires every 24h — need to refresh at https://developer.riotgames.com/
- Rate limits: 20 req/sec, 100 req/2min — sufficient for personal use but sync is sequential
- Imported CSV games have synthetic match IDs (prefixed `IMPORT_`) and no raw match JSON
- Match detail page won't show full player data for imported games
- First user auto-promoted to admin; subsequent users need an invite code
