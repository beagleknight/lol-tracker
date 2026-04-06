-- Validation for migration 0026: migrate existing Riot accounts
--
-- Each query should return 0 rows. Any rows indicate a data integrity issue
-- that would cause production users to lose visibility of their accounts.

-- Every user with a puuid must have at least one riot_accounts row
SELECT u.id AS user_id, u.puuid
FROM users u
WHERE u.puuid IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM riot_accounts ra WHERE ra.user_id = u.id
  );
--> statement-breakpoint
-- Every user with a puuid must have active_riot_account_id set
SELECT id AS user_id
FROM users
WHERE puuid IS NOT NULL AND active_riot_account_id IS NULL;
