CREATE TABLE `sync_locks` (
	`user_id` text PRIMARY KEY NOT NULL,
	`locked_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
