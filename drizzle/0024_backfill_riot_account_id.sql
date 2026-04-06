-- Backfill riot_account_id on rows that were created before multi-account migration.
-- Uses the user's primary riot account as the value.
-- This is safe to re-run (only touches rows where riot_account_id IS NULL).

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
