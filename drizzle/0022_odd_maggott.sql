CREATE TABLE `riot_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`puuid` text NOT NULL,
	`riot_game_name` text NOT NULL,
	`riot_tag_line` text NOT NULL,
	`summoner_id` text,
	`region` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`label` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `riot_accounts_user_idx` ON `riot_accounts` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `riot_accounts_user_puuid_unq` ON `riot_accounts` (`user_id`,`puuid`);--> statement-breakpoint
ALTER TABLE `ai_insights` ADD `riot_account_id` text REFERENCES riot_accounts(id);--> statement-breakpoint
ALTER TABLE `goals` ADD `riot_account_id` text REFERENCES riot_accounts(id);--> statement-breakpoint
ALTER TABLE `match_highlights` ADD `riot_account_id` text REFERENCES riot_accounts(id);--> statement-breakpoint
ALTER TABLE `matches` ADD `riot_account_id` text REFERENCES riot_accounts(id);--> statement-breakpoint
CREATE INDEX `matches_riot_account_idx` ON `matches` (`riot_account_id`);--> statement-breakpoint
ALTER TABLE `rank_snapshots` ADD `riot_account_id` text REFERENCES riot_accounts(id);--> statement-breakpoint
CREATE INDEX `rank_snapshots_riot_account_idx` ON `rank_snapshots` (`riot_account_id`);--> statement-breakpoint
ALTER TABLE `users` ADD `active_riot_account_id` text;