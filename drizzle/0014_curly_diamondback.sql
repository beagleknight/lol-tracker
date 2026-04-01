PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_coaching_action_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer,
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
INSERT INTO `__new_coaching_action_items`("id", "session_id", "user_id", "description", "topic", "status", "completed_at", "created_at") SELECT "id", "session_id", "user_id", "description", "topic", "status", "completed_at", "created_at" FROM `coaching_action_items`;--> statement-breakpoint
DROP TABLE `coaching_action_items`;--> statement-breakpoint
ALTER TABLE `__new_coaching_action_items` RENAME TO `coaching_action_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `action_items_user_status_idx` ON `coaching_action_items` (`user_id`,`status`);--> statement-breakpoint
CREATE INDEX `action_items_session_idx` ON `coaching_action_items` (`session_id`);--> statement-breakpoint
ALTER TABLE `coaching_sessions` ADD `focus_areas` text;