CREATE TABLE `coaching_action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`description` text NOT NULL,
	`topic` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`completed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `coaching_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `coaching_session_matches` (
	`session_id` integer NOT NULL,
	`match_id` text NOT NULL,
	PRIMARY KEY(`session_id`, `match_id`),
	FOREIGN KEY (`session_id`) REFERENCES `coaching_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `coaching_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`coach_name` text NOT NULL,
	`date` integer NOT NULL,
	`duration_minutes` integer,
	`topics` text,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
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
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `matches_odometer_unique` ON `matches` (`odometer`);--> statement-breakpoint
CREATE TABLE `rank_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`captured_at` integer NOT NULL,
	`tier` text,
	`division` text,
	`lp` integer DEFAULT 0,
	`wins` integer DEFAULT 0,
	`losses` integer DEFAULT 0,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`discord_id` text NOT NULL,
	`name` text,
	`image` text,
	`email` text,
	`riot_game_name` text,
	`riot_tag_line` text,
	`puuid` text,
	`summoner_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_discord_id_unique` ON `users` (`discord_id`);