ALTER TABLE `coaching_sessions` ADD `status` text DEFAULT 'scheduled' NOT NULL;--> statement-breakpoint
ALTER TABLE `coaching_sessions` ADD `vod_match_id` text;--> statement-breakpoint
CREATE INDEX `coaching_sessions_user_status_idx` ON `coaching_sessions` (`user_id`,`status`);