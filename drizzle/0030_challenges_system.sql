-- Migration: Revamp goals into challenges system
-- Supports multiple concurrent challenges of different types:
--   by-date: reach a rank by a deadline (like old goals)
--   by-games: track a metric over N games

CREATE TABLE `challenges` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `riot_account_id` text REFERENCES `riot_accounts`(`id`) ON DELETE SET NULL,
  `title` text NOT NULL,
  `type` text NOT NULL,
  `target_tier` text,
  `target_division` text,
  `start_tier` text,
  `start_division` text,
  `start_lp` integer DEFAULT 0,
  `deadline` integer,
  `metric` text,
  `metric_condition` text,
  `metric_threshold` real,
  `target_games` integer,
  `current_games` integer DEFAULT 0,
  `successful_games` integer DEFAULT 0,
  `status` text NOT NULL DEFAULT 'active',
  `created_at` integer NOT NULL,
  `completed_at` integer,
  `failed_at` integer,
  `retired_at` integer
);
--> statement-breakpoint
CREATE INDEX `challenges_user_status_idx` ON `challenges` (`user_id`, `status`);
--> statement-breakpoint
CREATE INDEX `challenges_user_type_idx` ON `challenges` (`user_id`, `type`);
--> statement-breakpoint

CREATE TABLE `challenge_topics` (
  `challenge_id` integer NOT NULL REFERENCES `challenges`(`id`) ON DELETE CASCADE,
  `topic_id` integer NOT NULL REFERENCES `topics`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`challenge_id`, `topic_id`)
);
--> statement-breakpoint
CREATE INDEX `challenge_topics_topic_idx` ON `challenge_topics` (`topic_id`);
--> statement-breakpoint

-- Migrate existing goals into challenges (by-date type)
-- riot_account_id may not exist in all environments, so we skip it.
-- The column will be NULL for migrated challenges; users can re-link if needed.
INSERT INTO `challenges` (
  `user_id`, `title`, `type`,
  `target_tier`, `target_division`, `start_tier`, `start_division`, `start_lp`,
  `deadline`, `status`, `created_at`, `completed_at`, `retired_at`
)
SELECT
  `user_id`, `title`, 'by-date',
  `target_tier`, `target_division`, `start_tier`, `start_division`, `start_lp`,
  `deadline`,
  CASE `status`
    WHEN 'achieved' THEN 'completed'
    WHEN 'retired' THEN 'retired'
    ELSE 'active'
  END,
  `created_at`,
  `achieved_at`,
  `retired_at`
FROM `goals`;
