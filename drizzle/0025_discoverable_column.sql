ALTER TABLE `riot_accounts` ADD `discoverable` integer DEFAULT true NOT NULL;
--> statement-breakpoint
UPDATE `riot_accounts` SET `discoverable` = 0 WHERE `is_primary` = 0;
