-- Validation: no matches with NULL riot_account_id for users who have a riot account
SELECT m.id, m.user_id
FROM matches m
JOIN users u ON u.id = m.user_id
WHERE u.puuid IS NOT NULL AND m.riot_account_id IS NULL;

-- Validation: no rank_snapshots with NULL riot_account_id for users who have a riot account
SELECT rs.id, rs.user_id
FROM rank_snapshots rs
JOIN users u ON u.id = rs.user_id
WHERE u.puuid IS NOT NULL AND rs.riot_account_id IS NULL;

-- Validation: no goals with NULL riot_account_id for users who have a riot account
SELECT g.id, g.user_id
FROM goals g
JOIN users u ON u.id = g.user_id
WHERE u.puuid IS NOT NULL AND g.riot_account_id IS NULL;

-- Validation: no match_highlights with NULL riot_account_id for users who have a riot account
SELECT mh.id, mh.user_id
FROM match_highlights mh
JOIN users u ON u.id = mh.user_id
WHERE u.puuid IS NOT NULL AND mh.riot_account_id IS NULL;

-- Validation: no ai_insights with NULL riot_account_id for users who have a riot account
SELECT ai.id, ai.user_id
FROM ai_insights ai
JOIN users u ON u.id = ai.user_id
WHERE u.puuid IS NOT NULL AND ai.riot_account_id IS NULL;
