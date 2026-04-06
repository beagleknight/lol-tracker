-- Validate: no users should have the obsolete 'user' role after migration.
-- Returns rows that still have role='user' — expecting 0 rows.
SELECT id AS user_id, role
FROM users
WHERE role = 'user';
