-- Validate challenges migration: all existing goals were migrated

-- Should return 0 rows: goals that were NOT migrated to challenges
SELECT g.id, g.user_id, g.title
FROM goals g
LEFT JOIN challenges c ON c.user_id = g.user_id AND c.title = g.title AND c.type = 'by-date'
WHERE c.id IS NULL;

-- Should return 0 rows: active challenges without required by-date fields
SELECT id, title FROM challenges
WHERE type = 'by-date' AND (target_tier IS NULL OR start_tier IS NULL);

-- Should return 0 rows: challenge count should match goal count
SELECT 'mismatch' AS error
WHERE (SELECT COUNT(*) FROM goals) != (SELECT COUNT(*) FROM challenges WHERE type = 'by-date');
