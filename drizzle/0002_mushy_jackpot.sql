PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_coaching_session_matches` (
	`session_id` integer NOT NULL,
	`match_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`session_id`, `match_id`),
	FOREIGN KEY (`session_id`) REFERENCES `coaching_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_coaching_session_matches`("session_id", "match_id", "user_id") SELECT csm."session_id", csm."match_id", cs."user_id" FROM `coaching_session_matches` csm INNER JOIN `coaching_sessions` cs ON cs."id" = csm."session_id";--> statement-breakpoint
DROP TABLE `coaching_session_matches`;--> statement-breakpoint
ALTER TABLE `__new_coaching_session_matches` RENAME TO `coaching_session_matches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_matches` (
	`id` text NOT NULL,
	`odometer` integer NOT NULL,
	`user_id` text NOT NULL,
	`game_date` integer NOT NULL,
	`result` text NOT NULL,
	`champion_id` integer NOT NULL,
	`champion_name` text NOT NULL,
	`rune_keystone_id` integer,
	`rune_keystone_name` text,
	`matchup_champion_id` integer,
	`matchup_champion_name` text,
	`kills` integer DEFAULT 0 NOT NULL,
	`deaths` integer DEFAULT 0 NOT NULL,
	`assists` integer DEFAULT 0 NOT NULL,
	`cs` integer DEFAULT 0 NOT NULL,
	`cs_per_min` real DEFAULT 0,
	`game_duration_seconds` integer DEFAULT 0 NOT NULL,
	`gold_earned` integer DEFAULT 0,
	`vision_score` integer DEFAULT 0,
	`comment` text,
	`reviewed` integer DEFAULT false NOT NULL,
	`review_notes` text,
	`queue_id` integer,
	`synced_at` integer NOT NULL,
	`raw_match_json` text,
	PRIMARY KEY(`id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_matches`("id", "odometer", "user_id", "game_date", "result", "champion_id", "champion_name", "rune_keystone_id", "rune_keystone_name", "matchup_champion_id", "matchup_champion_name", "kills", "deaths", "assists", "cs", "cs_per_min", "game_duration_seconds", "gold_earned", "vision_score", "comment", "reviewed", "review_notes", "queue_id", "synced_at", "raw_match_json") SELECT "id", "odometer", "user_id", "game_date", "result", "champion_id", "champion_name", "rune_keystone_id", "rune_keystone_name", "matchup_champion_id", "matchup_champion_name", "kills", "deaths", "assists", "cs", "cs_per_min", "game_duration_seconds", "gold_earned", "vision_score", "comment", "reviewed", "review_notes", "queue_id", "synced_at", "raw_match_json" FROM `matches`;--> statement-breakpoint
DROP TABLE `matches`;--> statement-breakpoint
ALTER TABLE `__new_matches` RENAME TO `matches`;--> statement-breakpoint
CREATE INDEX `matches_user_game_date_idx` ON `matches` (`user_id`,`game_date`);--> statement-breakpoint
CREATE INDEX `matches_user_reviewed_idx` ON `matches` (`user_id`,`reviewed`);--> statement-breakpoint
CREATE UNIQUE INDEX `matches_user_odometer_unq` ON `matches` (`user_id`,`odometer`);