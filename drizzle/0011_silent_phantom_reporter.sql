CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`target_tier` text NOT NULL,
	`target_division` text,
	`start_tier` text NOT NULL,
	`start_division` text,
	`start_lp` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`deadline` integer,
	`created_at` integer NOT NULL,
	`achieved_at` integer,
	`retired_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `goals_user_status_idx` ON `goals` (`user_id`,`status`);