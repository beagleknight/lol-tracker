-- Change role default from 'user' to 'free' and migrate existing users to 'premium'
ALTER TABLE `users` ALTER COLUMN "role" TO "role" text NOT NULL DEFAULT 'free';--> statement-breakpoint
UPDATE `users` SET `role` = 'premium' WHERE `role` = 'user';
