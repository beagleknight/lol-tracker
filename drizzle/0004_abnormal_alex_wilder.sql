CREATE TABLE `match_highlights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`text` text NOT NULL,
	`topic` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `match_highlights_match_user_idx` ON `match_highlights` (`match_id`,`user_id`);--> statement-breakpoint
ALTER TABLE `matches` ADD `review_skipped_reason` text;--> statement-breakpoint
ALTER TABLE `matches` ADD `vod_url` text;