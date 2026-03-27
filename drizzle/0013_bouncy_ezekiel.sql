CREATE TABLE `ai_insights` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`context_key` text NOT NULL,
	`content` text NOT NULL,
	`model` text NOT NULL,
	`prompt_tokens` integer,
	`completion_tokens` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_insights_user_created_idx` ON `ai_insights` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ai_insights_user_type_context_unq` ON `ai_insights` (`user_id`,`type`,`context_key`);