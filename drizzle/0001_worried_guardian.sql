CREATE TABLE `invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`created_by` text NOT NULL,
	`used_by` text,
	`used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`used_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invites_code_unique` ON `invites` (`code`);--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'user' NOT NULL;--> statement-breakpoint
CREATE INDEX `action_items_user_status_idx` ON `coaching_action_items` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `matches_user_game_date_idx` ON `matches` (`user_id`,`game_date`);--> statement-breakpoint
CREATE INDEX `matches_user_reviewed_idx` ON `matches` (`user_id`,`reviewed`);--> statement-breakpoint
CREATE INDEX `rank_snapshots_user_captured_idx` ON `rank_snapshots` (`user_id`,`captured_at`);