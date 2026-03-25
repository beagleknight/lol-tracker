# LoL Tracker — TODO

## Untested Flows (code exists, needs browser verification)
- [x] ~~Coaching session creation flow (create session, link matches, add action items)~~ (verified — form fills, VOD selection, focus areas, submit all work; redirects to detail page)
- [x] ~~Coaching session detail (view session, cycle action item statuses, delete session)~~ (verified — status cycling pending→in progress→completed→pending works; delete has confirm dialog)
- [x] ~~Action items page (filtering by status/topic, status cycling, delete)~~ (verified — filters work, status cycling works, delete now has confirm dialog)
- [x] ~~CSV import with actual file upload and data import~~ (removed — CSV import feature dropped, see Cleanup section)
- [x] ~~Inline comment editing on matches page~~ (removed — editing now lives exclusively on Review page)
- [x] ~~Inline review editing on matches page~~ (removed — editing now lives exclusively on Review page)
- [x] ~~Match detail: save game notes and VOD review notes~~ (removed — match detail is now read-only; editing on Review page)
- [x] ~~Invite system: test full flow (new user with invite code, reject without code)~~ (partially verified — admin generate/copy/delete tested; new user sign-up with invite not tested in browser, requires separate Discord account)
- [x] ~~Admin settings: generate/copy/delete invite codes~~ (verified — generate creates code with toast, copy works, delete now has confirm dialog)
- [x] ~~Auth proxy: verify redirect-to-login flow with Auth.js wrapper~~ (removed — `src/proxy.ts` was dead code, never wired as middleware; Auth.js handles auth natively)

## UX Feedback (user-reported, actionable)

### Sync Games — global access
- [x] ~~Move "Sync Games" to a persistent, always-visible location (e.g., sidebar or top bar)~~ (moved to sidebar header — subtle RefreshCw icon, always reachable, spins while syncing)

### Dashboard — review widget clarity
- [x] ~~Dashboard "games to review" widget: break down the count by review stage~~ (shows "3 post-game · 2 VOD review" with deep links to `/review?tab=post-game` and `/review?tab=vod`)

### Match Detail — highlight visibility
- [x] ~~Match detail: promote highlights/lowlights section higher on the page~~ (moved above player tables, directly after stats row; only renders when highlights exist)

### Review Page — sort order & navigation
- [x] ~~Review page: show games to review oldest-first~~ (changed `orderBy` from `desc` to `asc` for unreviewed matches)
- [x] ~~Review page: preserve the active tab when navigating back from match detail~~ (tab synced to `?tab=` URL param via `router.replace`; maps post-game→0, vod→1, completed→2)

### Duo Page — performance (critical)
- [x] ~~Duo page: the top section (partner info / stats) is still too slow despite previous query optimizations~~ (Suspense streaming with skeleton fallbacks + SQL optimizations from prior session; stale-until-next-sync via `"use cache: remote"`)

### Analytics — layout & language
- [x] ~~Analytics page: rethink layout~~ (side-by-side 2-col grid for Rank Journey + Win Rate charts; remaining: charts smaller/collapsible, stats higher up)
- [x] ~~Analytics / Rank Journey: remove technical language like "snapshots"~~ ("snapshots tracked" → "rank updates tracked", "intervals" → "time between", "overlay" → "show", improved empty states)

### Matchup Scout — simplify scope
- [x] ~~Matchup Scout: remove "Check Game" (live game lookup) feature entirely for now~~ (removed ~70 lines of live game detection UI; may revisit in the future, see Future Enhancements)
- [x] ~~Matchup Scout: remove the inline review functionality~~ (removed ~220 lines of PostGameReviewCard; replaced with subtle gold banner linking to `/review?tab=post-game`)

### Coaching — VOD optional & reminders
- [x] ~~Coaching session scheduling: make VOD URL optional at creation time~~ (`vodMatchId` optional in action, conditional session-match insert, form says "Optionally select...")
- [x] ~~Coaching upcoming sessions (dashboard): show a visual indicator when VOD is missing~~ (amber "No VOD" badge on coaching hub + "No VOD selected yet" on dashboard Next Session card)
- [x] ~~Coaching completed sessions: show reminders/nudges for sessions that are finished but missing focus areas or action items~~ (amber nudge text: "Missing focus areas and action items" / "Missing focus areas" / "Missing action items")

### User-facing language audit
- [x] ~~Audit all user-facing text for technical/developer jargon~~ (~25 high-impact fixes: "sync" → "update/import/fetch", removed "Riot API" from user text, fixed CS formatting, improved error messages with "Please try again", removed HTTP status codes)

## Cleanup — Remove Unused Features
- [x] ~~Remove CSV import/merge feature entirely — no longer needed, the app is the primary data source now~~
- [x] ~~Dead code cleanup round: deleted 6 dead files, removed ~34 unused exports, 4 unused functions, 8 unused interfaces, 1 unused import across 9 files~~
- [ ] (Future) Consider adding CSV/data export instead, if needed

## Polish
- [x] ~~Responsive refinements (mobile experience for tables, forms, etc.)~~ (MatchCard compact mobile KDA, Scout 'vs' indicator visible on mobile, Match detail hides Vision/Gold/Damage columns on mobile, Analytics Y-axis width reduced, Matches filter selects responsive widths, Complete session action items stack vertically on mobile, Schedule session VOD buttons wrap, Duo recent games wrap on mobile)
- [x] ~~Empty states with illustrations/helpful messages (no matches yet, no coaching sessions, etc.)~~ (Dashboard coaching session placeholder when no session scheduled, Analytics rank chart 'not enough data' message, Analytics matchup/champion tables show empty messages, Duo synergy card shows empty message instead of silent null)
- [x] ~~Matches page: unify expanded card into single save button~~ (moot — MatchCard is no longer expandable; review editing moved to Review page)
- [x] ~~Matches page: replace raw HTML `<select>` in HighlightsEditor with shadcn Select component~~ (moot — highlights editing only on Review page now)
- [x] ~~Matches page: add VOD URL field to expanded match card~~ (moot — no expanded card; VOD URL on Review page)
- [x] ~~Matches page: standardize button sizes, variants, and icons across all forms~~ (moot — no forms on MatchCard anymore)
- [x] ~~Matches page: ensure PostGameReviewCard (scout) matches the updated MatchCard form style/fields~~ (moot — MatchCard has no form; scout PostGameReviewCard is its own component)
- [x] Sidebar: review and reorganize — only "Coaching" category visible as the nav has grown; group items into logical categories, improve hierarchy and scannability
- [x] Sidebar: fix active link highlighting for nested routes — `/coaching/action-items` no longer also highlights the parent "Sessions" link (uses smarter prefix matching that defers to more specific sibling routes)
- [x] Sidebar: add review counter badge — gold pill on "Review" nav link shows total unreviewed count (fetched in layout); replaces scattered review banners on other pages
- [x] Sidebar: highlight sync button — gold-tinted ring and hover state when Riot account is linked, so it's more discoverable
- [x] ~~Matches page: remove duplicate "Update Games" sync button~~ (now only in sidebar)
- [x] ~~Scout page: remove "games waiting for review" banner~~ (replaced by sidebar review counter)
- [x] ~~Dashboard: remove Review Card widget~~ (replaced by sidebar review counter; match detail review nudge kept)
- [x] Color contrast audit: fix poor text-on-background contrast throughout the app (e.g., dark text on bright blue win-row in Duo Recent Games)
- [x] ~~List/table sort overhaul: audit non-paginated lists across Duo, Analytics, and Dashboard — add sensible default sort order (e.g., win rate or games played) and make sort criteria visible/toggleable. Champion Synergy on Duo page is a good first candidate (currently sorted by games but not obvious).~~
- [x] ~~Match detail: rune keystone icon in header subtitle renders as broken/garbled emoji — replace with proper DDragon rune image or remove the inline icon~~
- [x] ~~Match detail: "Blue Team" label and its player table are slightly misaligned horizontally compared to "Red Team" — likely a padding/border offset from the highlighted player/duo row styling~~
- [x] ~~Paginated tables: inconsistent loading states — some pages (e.g., Duo) show an ugly spinner at the bottom instead of a proper loading skeleton; use the Matches page as the reference implementation~~
- [x] ~~Scout page: sync selectors (your champion, enemy champion, queue) to URL query params so the page state survives reloads and is shareable — the searchParams are already parsed server-side, just need the client selectors to read from/write to the URL~~
- [x] ~~Review page styling pass: improve visual design of highlight/lowlight tags (size, colors, spacing) and comment/notes display across all three tabs (Post-Game, VOD Review, Completed)~~
- [x] ~~MatchCard tooltip styling: review tooltip content for highlights and comments — ensure readable formatting and consistent look~~
- [x] ~~Match detail read-only display: polish how highlights, comments, and review notes are presented (typography, spacing, visual hierarchy)~~

## Performance
- [x] Duo page: added composite index `(userId, duoPartnerPuuid)` — all duo queries were doing full table scans
- [x] Duo page: parallelized count + select in `getDuoGames` (was sequential waterfall)
- [x] Duo page: added SQL LIMIT to `getChampionSynergy` (was fetching all combos, client used 15)
- [x] Duo page: Suspense streaming — split into 3 async server components with skeleton fallbacks; only partner info + ddragon are blocking, stats/synergy/games stream in
- [x] Match detail: strip `rawMatchJson` (50-100KB) from RSC payload — only used server-side
- [x] Match detail: flatten waterfall — `getLatestVersion()` now starts immediately alongside match fetch
- [x] Analytics: trim column selection from 22 to 8 — only fetch `gameDate`, `result`, `championName`, `matchupChampionName`, `runeKeystoneName`, `kills`, `deaths`, `assists`
- [x] Coaching detail: flatten 4-stage waterfall to 3 — highlights query joins through `coachingSessionMatches` on `sessionId`, runs in parallel with match/items/ddragon fetches
- [x] Review: add `limit: 50` to unbounded unreviewed matches query
- [x] Tier 1 pages: `"use cache: remote"` with `cacheLife("hours")` for persistent Vercel distributed cache (Duo, Analytics, Coaching, Scout, Review)

## Features — Rank Journey (LP Tracking)
- [x] Before-sync rank snapshot: capture rank at start of sync (in addition to end) for smoother LP chart with 2 data points per sync
- [x] Milestone detection: peak rank marker + first-time-in-tier milestones on the LP chart
- [x] Growth framing: renamed "LP Over Time" to "Rank Journey", promotion labels say "Reached X" instead of "Promoted", demotion labels say "Back to X", tooltip shows milestone context
- [x] Design decision: no per-game LP deltas shown anywhere — LP is framed as a long-term journey, not a per-game metric, to promote a healthy relationship with the game

## Features — Deployment
- [x] ~~Wire up `src/proxy.ts` as proper Next.js middleware (defense-in-depth auth guard)~~ (removed — file was dead code, Auth.js handles auth natively)
- [ ] Add smoke tests (build check, key routes return 200) and run them before auto-deploy

## Features — Future Enhancements
- [ ] Riot RSO authentication (Phase 2 — requires Production API key from Riot)
- [x] ~~Auto-sync on login or on a schedule (in addition to the always-visible manual sync)~~ (three triggers: login cookie consumed on mount, tab visibility change after 30min stale, jittered 12-18min periodic interval; silent mode skips toasts when no new matches found; manual sync button unchanged)
- [ ] Export data (CSV export of matches with all fields)
- [ ] Multi-account support (track games across multiple Riot accounts)
- [ ] Matchup-specific notes (per champion matchup, not just per game)
- [ ] Goal setting (e.g., "reach Diamond by end of split") with progress tracking
- [ ] Matchup Scout: revisit live game / champ select integration with a better UX when ready

## Features — Internationalization (nice to have)
- [x] ~~Date/time format preference: allow users to pick a locale-aware format (e.g., DD/MM/YYYY vs MM/DD/YYYY) — US date format is confusing for non-US users~~ (added `locale` column to users table, `formatDate`/`formatDuration`/`formatNumber` shared utilities in `src/lib/format.ts`, locale selector in Settings with live preview, all inline `Intl.DateTimeFormat` calls replaced across 13 client components, supports en-GB/en-US/es-ES)
- [x] ~~Multi-language support (i18n): start with English + Spanish; translations can be AI-generated and maintained with assistance, so the burden stays low~~ (installed `next-intl` v4.8.3, cookie-based locale detection with Accept-Language fallback, added `language` column to users table, 290+ translated strings in `messages/en.json` + `messages/es.json` across 17 namespaces, all 19 client components use `useTranslations`, Language & Region settings card with independent UI language + date/number format dropdowns, server action errors are code-based and translated client-side, `NextIntlClientProvider` wrapped in `<Suspense>` for PPR/cacheComponents compatibility)

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
- Multi-user rate limits: auto-sync intervals are jittered (12-18min) to avoid thundering herd. At 10+ concurrent users, may need server-side throttling (global rate limiter or per-user last-sync-at check) to stay within the 100 req/2min API key limit
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
