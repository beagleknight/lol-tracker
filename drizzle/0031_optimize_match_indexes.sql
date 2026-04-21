DROP INDEX IF EXISTS `matches_user_reviewed_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `matches_user_duo_partner_idx`;--> statement-breakpoint
DROP INDEX IF EXISTS `matches_user_position_idx`;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `matches_user_riot_reviewed_result_idx` ON `matches` (`user_id`, `riot_account_id`, `reviewed`, `result`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `matches_user_riot_duo_idx` ON `matches` (`user_id`, `riot_account_id`, `duo_partner_puuid`);
