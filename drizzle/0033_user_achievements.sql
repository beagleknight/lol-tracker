-- Migration 0033: User Achievements
--
-- Adds the user_achievements table to track which achievements a user has
-- unlocked and at what tier. Achievement definitions are static in code
-- (src/lib/achievements.ts), not in the database.

CREATE TABLE IF NOT EXISTS `user_achievements` (
  `achievement_id` text NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `tier` integer,
  `unlocked_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  PRIMARY KEY (`achievement_id`, `user_id`)
);

CREATE INDEX IF NOT EXISTS `user_achievements_user_idx` ON `user_achievements` (`user_id`);
