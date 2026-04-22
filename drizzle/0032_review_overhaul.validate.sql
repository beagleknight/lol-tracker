-- Validation for 0032_review_overhaul
-- Each query should return 0 rows if data is correct.

-- 1. No action items should have old statuses (pending/in_progress)
SELECT id, status FROM coaching_action_items WHERE status IN ('pending', 'in_progress');
