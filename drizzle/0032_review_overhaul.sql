-- Migration 0032: Review & Action Items Overhaul
--
-- 1. Make match_highlights.text nullable (new highlights are topic-click only)
-- 2. Create match_action_item_outcomes table (per-game action item tracking)
-- 3. Migrate highlight texts + review_notes into unified comment field
-- 4. Change action item statuses from pending/in_progress/completed to active/completed
-- 5. Drop review_notes and review_skipped_reason columns from matches
--
-- Data safety: all existing review data (highlights text, review_notes, review_skipped_reason)
-- is preserved by merging into the comment field before dropping columns.

-- Step 1: Recreate match_highlights with nullable text
-- SQLite doesn't support ALTER COLUMN, so we recreate the table.
CREATE TABLE IF NOT EXISTS `match_highlights_new` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `match_id` text NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `riot_account_id` text REFERENCES `riot_accounts`(`id`) ON DELETE SET NULL,
  `type` text NOT NULL,
  `text` text,
  `topic_id` integer REFERENCES `topics`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch())
);--> statement-breakpoint

INSERT INTO `match_highlights_new` (`id`, `match_id`, `user_id`, `riot_account_id`, `type`, `text`, `topic_id`, `created_at`)
SELECT `id`, `match_id`, `user_id`, `riot_account_id`, `type`, `text`, `topic_id`, `created_at`
FROM `match_highlights`;--> statement-breakpoint

DROP TABLE `match_highlights`;--> statement-breakpoint

ALTER TABLE `match_highlights_new` RENAME TO `match_highlights`;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `match_highlights_match_user_idx` ON `match_highlights` (`match_id`, `user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `match_highlights_user_idx` ON `match_highlights` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `match_highlights_topic_idx` ON `match_highlights` (`topic_id`);--> statement-breakpoint

-- Step 2: Create match_action_item_outcomes table
CREATE TABLE IF NOT EXISTS `match_action_item_outcomes` (
  `match_id` text NOT NULL,
  `action_item_id` integer NOT NULL REFERENCES `coaching_action_items`(`id`) ON DELETE CASCADE,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `outcome` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (`match_id`, `action_item_id`)
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `match_action_item_outcomes_user_idx` ON `match_action_item_outcomes` (`user_id`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `match_action_item_outcomes_item_idx` ON `match_action_item_outcomes` (`action_item_id`);--> statement-breakpoint

-- Step 3: Merge highlight texts into comment field
-- For each match that has highlights with text, build a bullet list and prepend to comment.
-- Format: "- ✅ [Topic] Text" for highlights, "- ❌ [Topic] Text" for lowlights
-- We use a CTE to build the merged text per match.
UPDATE `matches` SET `comment` = (
  WITH highlight_lines AS (
    SELECT
      mh.match_id,
      mh.user_id,
      '- ' ||
        CASE WHEN mh.type = 'highlight' THEN '✅' ELSE '❌' END ||
        CASE WHEN t.name IS NOT NULL THEN ' [' || t.name || ']' ELSE '' END ||
        CASE WHEN mh.text IS NOT NULL AND mh.text != '' THEN ' ' || mh.text ELSE '' END
        AS line,
      mh.id AS sort_key
    FROM match_highlights mh
    LEFT JOIN topics t ON t.id = mh.topic_id
    WHERE mh.match_id = matches.id AND mh.user_id = matches.user_id
      AND mh.text IS NOT NULL AND mh.text != ''
  ),
  merged_highlights AS (
    SELECT match_id, user_id, group_concat(line, char(10)) AS bullet_list
    FROM highlight_lines
    GROUP BY match_id, user_id
  )
  SELECT
    CASE
      -- Both highlight text and existing comment
      WHEN mh.bullet_list IS NOT NULL AND matches.comment IS NOT NULL AND matches.comment != ''
        THEN mh.bullet_list || char(10) || char(10) || '---' || char(10) || char(10) || matches.comment
      -- Only highlight text
      WHEN mh.bullet_list IS NOT NULL
        THEN mh.bullet_list
      -- Only existing comment (no change)
      ELSE matches.comment
    END
  FROM merged_highlights mh
  WHERE mh.match_id = matches.id AND mh.user_id = matches.user_id
)
WHERE EXISTS (
  SELECT 1 FROM match_highlights mh2
  WHERE mh2.match_id = matches.id AND mh2.user_id = matches.user_id
    AND mh2.text IS NOT NULL AND mh2.text != ''
);--> statement-breakpoint

-- Step 4: Merge review_notes into comment field
-- For matches with review_notes, append after existing comment (separated by ---)
UPDATE `matches` SET `comment` =
  CASE
    WHEN `comment` IS NOT NULL AND `comment` != '' AND `review_notes` IS NOT NULL AND `review_notes` != ''
      THEN `comment` || char(10) || char(10) || '---' || char(10) || char(10) || `review_notes`
    WHEN `review_notes` IS NOT NULL AND `review_notes` != ''
      THEN `review_notes`
    ELSE `comment`
  END
WHERE `review_notes` IS NOT NULL AND `review_notes` != '';--> statement-breakpoint

-- Step 5: Migrate action item statuses: pending -> active, in_progress -> active
UPDATE `coaching_action_items` SET `status` = 'active' WHERE `status` = 'pending';--> statement-breakpoint
UPDATE `coaching_action_items` SET `status` = 'active' WHERE `status` = 'in_progress';--> statement-breakpoint

-- Step 6: Drop review_notes and review_skipped_reason from matches
-- SQLite doesn't support DROP COLUMN in all versions, so we recreate the table.
-- However, SQLite 3.35.0+ (2021-03-12) supports ALTER TABLE DROP COLUMN.
-- Turso uses libsql which is based on SQLite 3.43+, and local SQLite (macOS) is 3.39+.
ALTER TABLE `matches` DROP COLUMN `review_notes`;--> statement-breakpoint
ALTER TABLE `matches` DROP COLUMN `review_skipped_reason`;
