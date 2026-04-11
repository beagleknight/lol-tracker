-- Repair migration: backfill riot_account_id on rows that are still NULL.
--
-- Migration 0026 should have done this, but may have partially failed or
-- skipped rows where the riot_accounts record wasn't yet created at the
-- time the UPDATE ran. This causes matches (and other entities) to be
-- invisible to users because all user-facing queries filter by
-- riotAccountId via accountScope().
--
-- Bug report: GitHub issue #190 — user sees 6 of 100 matches.
--
-- Safe to re-run: only touches rows WHERE riot_account_id IS NULL.

UPDATE `matches` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `matches`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;--> statement-breakpoint

UPDATE `rank_snapshots` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `rank_snapshots`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;--> statement-breakpoint

UPDATE `goals` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `goals`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;--> statement-breakpoint

UPDATE `match_highlights` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `match_highlights`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;--> statement-breakpoint

UPDATE `ai_insights` SET `riot_account_id` = (
  SELECT ra.id FROM `riot_accounts` ra
  WHERE ra.user_id = `ai_insights`.`user_id` AND ra.is_primary = 1
  LIMIT 1
) WHERE `riot_account_id` IS NULL;
