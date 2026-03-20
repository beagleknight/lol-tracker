# LoL Tracker — TODO

## Untested Flows (code exists, needs browser verification)
- [ ] Coaching session creation flow (create session, link matches, add action items)
- [ ] Coaching session detail (view session, cycle action item statuses, delete session)
- [ ] Action items page (filtering by status/topic, status cycling, delete)
- [ ] CSV import with actual file upload and data import
- [ ] Inline comment editing on matches page (Add Comment button in table)
- [ ] Inline review editing on matches page (Review button in table)
- [ ] Match detail: save game notes and VOD review notes

## Polish
- [ ] Add loading states with Suspense boundaries and skeleton components
- [ ] Add error boundaries for graceful error handling
- [ ] Add toast notifications (Sonner) for success/error feedback on all actions
- [ ] Responsive refinements (mobile experience for tables, forms, etc.)
- [ ] Empty states with illustrations/helpful messages (no matches yet, no coaching sessions, etc.)

## Features — LP Tracking
- [ ] Capture LP before/after each game during sync (requires comparing rank snapshots)
- [ ] Add LP gain/loss column to matches table
- [ ] Add LP graph to dashboard and/or analytics page
- [ ] Show promotion/demotion markers on LP graph

## Features — Future Enhancements
- [ ] Riot RSO authentication (Phase 2 — requires Production API key from Riot)
- [ ] Auto-sync on login or on a schedule (instead of manual "Sync Games" button)
- [ ] Vercel deployment (swap SQLite for Turso/Libsql)
- [ ] Game VOD link field (YouTube/Twitch clip URL per match)
- [ ] Export data (CSV export of matches with all fields)
- [ ] Multi-account support (track games across multiple Riot accounts)
- [ ] Matchup-specific notes (per champion matchup, not just per game)
- [ ] Goal setting (e.g., "reach Diamond by end of split") with progress tracking

## Known Limitations
- Riot API personal key expires every 24h — need to refresh at https://developer.riotgames.com/
- Rate limits: 20 req/sec, 100 req/2min — sufficient for personal use but sync is sequential
- Imported CSV games have synthetic match IDs (prefixed `IMPORT_`) and no raw match JSON
- Match detail page won't show full player data for imported games
