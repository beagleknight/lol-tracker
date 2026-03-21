CREATE INDEX `action_items_session_idx` ON `coaching_action_items` (`session_id`);--> statement-breakpoint
CREATE INDEX `coaching_session_matches_match_user_idx` ON `coaching_session_matches` (`match_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `coaching_sessions_user_date_idx` ON `coaching_sessions` (`user_id`,`date`);--> statement-breakpoint
CREATE INDEX `match_highlights_user_idx` ON `match_highlights` (`user_id`);