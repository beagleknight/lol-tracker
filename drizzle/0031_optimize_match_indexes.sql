-- Migration: Optimize match indexes for common query patterns
-- Adds composite indexes covering (userId, riotAccountId, ...) for review counts,
-- dashboard stats, matches page, and duo queries.
-- Drops 3 redundant/unused indexes (net: 7 → 6 indexes on matches).

-- Drop subsumed indexes
DROP INDEX IF EXISTS `matches_user_reviewed_idx`;
DROP INDEX IF EXISTS `matches_user_duo_partner_idx`;
DROP INDEX IF EXISTS `matches_user_position_idx`;

-- Add composite indexes for hot query patterns
CREATE INDEX `matches_user_riot_reviewed_result_idx` ON `matches` (`user_id`, `riot_account_id`, `reviewed`, `result`);
CREATE INDEX `matches_user_riot_duo_idx` ON `matches` (`user_id`, `riot_account_id`, `duo_partner_puuid`);
