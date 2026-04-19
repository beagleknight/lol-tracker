-- Migration 0029: Normalize topics into a first-class table.
--
-- Previously, topics were a hardcoded list in src/lib/topics.ts stored as:
--   - coaching_sessions.topics: JSON array string
--   - match_highlights.topic: free-text string
--   - coaching_action_items.topic: free-text string
--
-- This migration:
--   1. Creates a `topics` table with the 10 predefined topics
--   2. Creates a `coaching_session_topics` join table (replaces JSON column)
--   3. Adds `topic_id` FK to match_highlights and coaching_action_items
--   4. Backfills all topic references from free-text to topic IDs
--   5. Drops the old text columns

-- Step 1: Create the topics table
CREATE TABLE `topics` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `slug` text NOT NULL,
  `name` text NOT NULL,
  `is_default` integer DEFAULT true NOT NULL,
  `user_id` text REFERENCES `users`(`id`) ON DELETE CASCADE,
  `created_at` integer NOT NULL DEFAULT (unixepoch() * 1000)
);--> statement-breakpoint

CREATE UNIQUE INDEX `topics_slug_unique` ON `topics` (`slug`);--> statement-breakpoint
CREATE INDEX `topics_user_idx` ON `topics` (`user_id`);--> statement-breakpoint

-- Step 2: Seed the 10 predefined topics
INSERT INTO `topics` (`slug`, `name`, `is_default`, `user_id`) VALUES
  ('laning-phase', 'Laning phase', 1, NULL),
  ('wave-management', 'Wave management', 1, NULL),
  ('trading-patterns', 'Trading patterns', 1, NULL),
  ('roaming-map-awareness', 'Roaming/map awareness', 1, NULL),
  ('vision-control', 'Vision control', 1, NULL),
  ('teamfighting', 'Teamfighting', 1, NULL),
  ('macro-objectives', 'Macro/objectives', 1, NULL),
  ('champion-specific-mechanics', 'Champion-specific mechanics', 1, NULL),
  ('mental-tilt-management', 'Mental/tilt management', 1, NULL),
  ('build-paths', 'Build paths', 1, NULL);--> statement-breakpoint

-- Step 3: Create coaching_session_topics join table
CREATE TABLE `coaching_session_topics` (
  `session_id` integer NOT NULL REFERENCES `coaching_sessions`(`id`) ON DELETE CASCADE,
  `topic_id` integer NOT NULL REFERENCES `topics`(`id`) ON DELETE CASCADE,
  PRIMARY KEY (`session_id`, `topic_id`)
);--> statement-breakpoint

CREATE INDEX `coaching_session_topics_topic_idx` ON `coaching_session_topics` (`topic_id`);--> statement-breakpoint

-- Step 4: Migrate coaching_sessions.topics JSON → coaching_session_topics rows
-- The JSON column stores values like '["Laning phase","Wave management"]'.
-- We also handle seed data inconsistencies: "Laning" → "Laning phase", etc.
-- We use json_each() to explode the JSON array, then fuzzy-match to topics.
INSERT OR IGNORE INTO `coaching_session_topics` (`session_id`, `topic_id`)
SELECT cs.id, t.id
FROM `coaching_sessions` cs,
     json_each(cs.topics) je,
     `topics` t
WHERE cs.topics IS NOT NULL
  AND cs.topics != 'null'
  AND (
    -- Exact match
    t.name = je.value
    -- Fuzzy matches for known seed inconsistencies
    OR (je.value = 'Laning' AND t.slug = 'laning-phase')
    OR (je.value = 'Team fighting' AND t.slug = 'teamfighting')
    OR (je.value = 'Roaming' AND t.slug = 'roaming-map-awareness')
    OR (je.value = 'Objective control' AND t.slug = 'macro-objectives')
  );--> statement-breakpoint

-- Step 5: Also migrate focusAreas JSON to coaching_session_topics
-- (focusAreas are pre-session focus topics — they should also be linked)
-- We skip this since focusAreas are a separate concept (pre-session planning)
-- and will remain as a JSON column for now.

-- Step 6: Add topic_id column to match_highlights
ALTER TABLE `match_highlights` ADD `topic_id` integer REFERENCES `topics`(`id`) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `match_highlights_topic_idx` ON `match_highlights` (`topic_id`);--> statement-breakpoint

-- Backfill match_highlights.topic_id from the free-text topic column
UPDATE `match_highlights` SET `topic_id` = (
  SELECT t.id FROM `topics` t
  WHERE t.name = `match_highlights`.`topic`
     OR (`match_highlights`.`topic` = 'Laning' AND t.slug = 'laning-phase')
     OR (`match_highlights`.`topic` = 'Team fighting' AND t.slug = 'teamfighting')
     OR (`match_highlights`.`topic` = 'Roaming' AND t.slug = 'roaming-map-awareness')
     OR (`match_highlights`.`topic` = 'Objective control' AND t.slug = 'macro-objectives')
  LIMIT 1
) WHERE `topic` IS NOT NULL;--> statement-breakpoint

-- Step 7: Add topic_id column to coaching_action_items
ALTER TABLE `coaching_action_items` ADD `topic_id` integer REFERENCES `topics`(`id`) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `action_items_topic_idx` ON `coaching_action_items` (`topic_id`);--> statement-breakpoint

-- Backfill coaching_action_items.topic_id from the free-text topic column
UPDATE `coaching_action_items` SET `topic_id` = (
  SELECT t.id FROM `topics` t
  WHERE t.name = `coaching_action_items`.`topic`
     OR (`coaching_action_items`.`topic` = 'Laning' AND t.slug = 'laning-phase')
     OR (`coaching_action_items`.`topic` = 'Team fighting' AND t.slug = 'teamfighting')
     OR (`coaching_action_items`.`topic` = 'Roaming' AND t.slug = 'roaming-map-awareness')
     OR (`coaching_action_items`.`topic` = 'Objective control' AND t.slug = 'macro-objectives')
  LIMIT 1
) WHERE `topic` IS NOT NULL;--> statement-breakpoint

-- Step 8: Drop old text columns
-- coaching_sessions.topics is replaced by coaching_session_topics join table
ALTER TABLE `coaching_sessions` DROP COLUMN `topics`;--> statement-breakpoint

-- match_highlights.topic is replaced by topic_id FK
ALTER TABLE `match_highlights` DROP COLUMN `topic`;--> statement-breakpoint

-- coaching_action_items.topic is replaced by topic_id FK
ALTER TABLE `coaching_action_items` DROP COLUMN `topic`;
