ALTER TABLE `matches` ADD `position` text;--> statement-breakpoint
CREATE INDEX `matches_user_position_idx` ON `matches` (`user_id`,`position`);--> statement-breakpoint
ALTER TABLE `users` ADD `primary_role` text;--> statement-breakpoint
ALTER TABLE `users` ADD `secondary_role` text;