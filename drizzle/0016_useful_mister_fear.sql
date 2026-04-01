ALTER TABLE `users` ADD `region` text;--> statement-breakpoint
ALTER TABLE `users` ADD `onboarding_completed` integer DEFAULT false NOT NULL;