CREATE TABLE `matchup_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`champion_name` text,
	`matchup_champion_name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matchup_notes_user_matchup_idx` ON `matchup_notes` (`user_id`,`matchup_champion_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `matchup_notes_user_champ_matchup_unq` ON `matchup_notes` (`user_id`,`champion_name`,`matchup_champion_name`);