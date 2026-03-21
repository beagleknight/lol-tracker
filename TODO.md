# LoL Tracker — TODO

## Untested Flows (code exists, needs browser verification)
- [ ] Coaching session creation flow (create session, link matches, add action items)
- [ ] Coaching session detail (view session, cycle action item statuses, delete session)
- [ ] Action items page (filtering by status/topic, status cycling, delete)
- [ ] CSV import with actual file upload and data import
- [x] ~~Inline comment editing on matches page~~ (removed — editing now lives exclusively on Review page)
- [x] ~~Inline review editing on matches page~~ (removed — editing now lives exclusively on Review page)
- [x] ~~Match detail: save game notes and VOD review notes~~ (removed — match detail is now read-only; editing on Review page)
- [ ] Invite system: test full flow (new user with invite code, reject without code)
- [ ] Admin settings: generate/copy/delete invite codes
- [ ] Auth proxy: verify redirect-to-login flow with Auth.js wrapper

## Polish
- [ ] Responsive refinements (mobile experience for tables, forms, etc.)
- [ ] Empty states with illustrations/helpful messages (no matches yet, no coaching sessions, etc.)
- [x] ~~Matches page: unify expanded card into single save button~~ (moot — MatchCard is no longer expandable; review editing moved to Review page)
- [x] ~~Matches page: replace raw HTML `<select>` in HighlightsEditor with shadcn Select component~~ (moot — highlights editing only on Review page now)
- [x] ~~Matches page: add VOD URL field to expanded match card~~ (moot — no expanded card; VOD URL on Review page)
- [x] ~~Matches page: standardize button sizes, variants, and icons across all forms~~ (moot — no forms on MatchCard anymore)
- [x] ~~Matches page: ensure PostGameReviewCard (scout) matches the updated MatchCard form style/fields~~ (moot — MatchCard has no form; scout PostGameReviewCard is its own component)
- [x] Sidebar: review and reorganize — only "Coaching" category visible as the nav has grown; group items into logical categories, improve hierarchy and scannability
- [x] Color contrast audit: fix poor text-on-background contrast throughout the app (e.g., dark text on bright blue win-row in Duo Recent Games)
- [ ] List/table sort overhaul: audit non-paginated lists across Duo, Analytics, and Dashboard — add sensible default sort order (e.g., win rate or games played) and make sort criteria visible/toggleable. Champion Synergy on Duo page is a good first candidate (currently sorted by games but not obvious).
- [ ] Match detail: rune keystone icon in header subtitle renders as broken/garbled emoji — replace with proper DDragon rune image or remove the inline icon
- [ ] Match detail: "Blue Team" label and its player table are slightly misaligned horizontally compared to "Red Team" — likely a padding/border offset from the highlighted player/duo row styling
- [ ] Paginated tables: inconsistent loading states — some pages (e.g., Duo) show an ugly spinner at the bottom instead of a proper loading skeleton; use the Matches page as the reference implementation
- [ ] Review page styling pass: improve visual design of highlight/lowlight tags (size, colors, spacing) and comment/notes display across all three tabs (Post-Game, VOD Review, Completed)
- [ ] MatchCard tooltip styling: review tooltip content for highlights and comments — ensure readable formatting and consistent look
- [ ] Match detail read-only display: polish how highlights, comments, and review notes are presented (typography, spacing, visual hierarchy)

## Performance
- [x] Duo page: added composite index `(userId, duoPartnerPuuid)` — all duo queries were doing full table scans
- [x] Duo page: parallelized count + select in `getDuoGames` (was sequential waterfall)
- [x] Duo page: added SQL LIMIT to `getChampionSynergy` (was fetching all combos, client used 15)
- [ ] Duo page: remaining slowness is likely Vercel cold starts (~5-10s on free tier) — consider Suspense streaming to improve perceived performance

## Features — LP Tracking
- [ ] Capture LP before/after each game during sync (requires comparing rank snapshots)
- [ ] Add LP gain/loss column to matches table
- [ ] Show promotion/demotion markers on LP graph

## Features — Deployment
- [ ] Wire up `src/proxy.ts` as proper Next.js middleware (defense-in-depth auth guard)
- [ ] Add smoke tests (build check, key routes return 200) and run them before auto-deploy

## Features — Future Enhancements
- [ ] Riot RSO authentication (Phase 2 — requires Production API key from Riot)
- [ ] Auto-sync on login or on a schedule (instead of manual "Sync Games" button)
- [ ] Export data (CSV export of matches with all fields)
- [ ] Multi-account support (track games across multiple Riot accounts)
- [ ] Matchup-specific notes (per champion matchup, not just per game)
- [ ] Goal setting (e.g., "reach Diamond by end of split") with progress tracking

## Features — Internationalization (nice to have)
- [ ] Date/time format preference: allow users to pick a locale-aware format (e.g., DD/MM/YYYY vs MM/DD/YYYY) — US date format is confusing for non-US users
- [ ] Multi-language support (i18n): start with English + Spanish; translations can be AI-generated and maintained with assistance, so the burden stays low

## Features — Duo Partner Tracking & Synergy
- [ ] Duo-specific analytics: lane proximity, shared kills/assists, how often you die together vs separately

## Features — Ascent VOD Integration
- [ ] Scrape user's Ascent profile to pull VOD links (no known public API — web scraping or headless browser needed)
- [ ] Auto-match Ascent VODs to synced games by game timestamp or Riot match ID
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

## Known Limitations
- Rate limits: 20 req/sec, 100 req/2min — sufficient for personal use but sync is sequential
- Imported CSV games have synthetic match IDs (prefixed `IMPORT_`) and no raw match JSON
- Match detail page won't show full player data for imported games
- First user auto-promoted to admin; subsequent users need an invite code

## Cleanup — Remove Dev API Key Workarounds
Now that we have a non-expiring Personal API Key, the following dev-key workarounds can be removed or simplified:
- [x] Remove `validateRiotApiKey()` server action in `src/app/actions/settings.ts` (lines 81-129)
- [x] Remove admin "API Key Status" card from Settings UI (`src/app/(app)/settings/page.tsx` — state, auto-check, card)
- [x] Remove non-admin "API Key Info" card from Settings UI (`src/app/(app)/settings/page.tsx` — lines 599-633)
- [x] Simplify 401/403 error messages in `riotFetch` (`src/lib/riot-api.ts:123-128`) — remove "Regenerate at developer.riotgames.com"
- [x] Simplify 401/403 error messages in `getActiveGame` (`src/lib/riot-api.ts:278-283`) — same
- [x] Update `.env.example` — remove "expires every 24 hours" note (line 13)
- [x] Update `README.md` — remove bold warning about key expiration (line 63)
- [x] Update `.opencode/skills/riot-api/SKILL.md` — update key expiration references (lines 20-23, 207)
