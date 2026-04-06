-- Migrate existing Riot account data from users table into riot_accounts.
-- This was missing from migration 0022 which created the table but never
-- populated it, leaving all existing users with no linked accounts.
--
-- Safe to re-run: uses INSERT OR IGNORE with the unique constraint on (user_id, puuid).

INSERT OR IGNORE INTO `riot_accounts` (`id`, `user_id`, `puuid`, `riot_game_name`, `riot_tag_line`, `summoner_id`, `region`, `is_primary`, `created_at`)
SELECT
  lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(hex(randomblob(2)),2) || '-' || hex(randomblob(6))),
  `id`,
  `puuid`,
  `riot_game_name`,
  `riot_tag_line`,
  `summoner_id`,
  `region`,
  1,
  COALESCE(`created_at`, unixepoch())
FROM `users`
WHERE `puuid` IS NOT NULL
  AND `riot_game_name` IS NOT NULL
  AND `riot_tag_line` IS NOT NULL
  AND `region` IS NOT NULL;
--> statement-breakpoint
-- Set active_riot_account_id on users that don't have one yet
UPDATE `users` SET `active_riot_account_id` = (
  SELECT `id` FROM `riot_accounts`
  WHERE `riot_accounts`.`user_id` = `users`.`id` AND `riot_accounts`.`is_primary` = 1
  LIMIT 1
) WHERE `puuid` IS NOT NULL AND `active_riot_account_id` IS NULL;
--> statement-breakpoint
-- Copy role preferences from users to their primary riot account
UPDATE `riot_accounts` SET
  `primary_role` = (SELECT `primary_role` FROM `users` WHERE `users`.`id` = `riot_accounts`.`user_id`),
  `secondary_role` = (SELECT `secondary_role` FROM `users` WHERE `users`.`id` = `riot_accounts`.`user_id`)
WHERE `is_primary` = 1 AND `primary_role` IS NULL;
--> statement-breakpoint
-- Re-run backfill of riot_account_id on dependent tables (was no-op in 0024 because riot_accounts was empty)
UPDATE `matches` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `matches`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;
--> statement-breakpoint
UPDATE `rank_snapshots` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `rank_snapshots`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;
--> statement-breakpoint
UPDATE `goals` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `goals`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;
--> statement-breakpoint
UPDATE `match_highlights` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `match_highlights`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;
--> statement-breakpoint
UPDATE `ai_insights` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `ai_insights`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;