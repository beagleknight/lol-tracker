-- Validation for migration 0029: normalize topics
-- Each query should return 0 rows if data integrity is correct.

-- 1. All 10 predefined topics must exist
SELECT 'missing_predefined_topic' AS issue, expected.name
FROM (
  SELECT 'Laning phase' AS name UNION ALL
  SELECT 'Wave management' UNION ALL
  SELECT 'Trading patterns' UNION ALL
  SELECT 'Roaming/map awareness' UNION ALL
  SELECT 'Vision control' UNION ALL
  SELECT 'Teamfighting' UNION ALL
  SELECT 'Macro/objectives' UNION ALL
  SELECT 'Champion-specific mechanics' UNION ALL
  SELECT 'Mental/tilt management' UNION ALL
  SELECT 'Build paths'
) expected
LEFT JOIN `topics` t ON t.name = expected.name AND t.is_default = 1
WHERE t.id IS NULL;

-- 2. No match_highlights should have a NULL topic_id if the old topic column had data
--    (We can't check the old column since it's dropped, but we can verify topic_id references are valid)
SELECT 'invalid_highlight_topic_ref' AS issue, mh.id
FROM `match_highlights` mh
WHERE mh.topic_id IS NOT NULL
  AND mh.topic_id NOT IN (SELECT id FROM `topics`);

-- 3. No coaching_action_items should have an invalid topic_id reference
SELECT 'invalid_action_item_topic_ref' AS issue, cai.id
FROM `coaching_action_items` cai
WHERE cai.topic_id IS NOT NULL
  AND cai.topic_id NOT IN (SELECT id FROM `topics`);

-- 4. No coaching_session_topics should reference non-existent sessions or topics
SELECT 'orphan_session_topic' AS issue, cst.session_id, cst.topic_id
FROM `coaching_session_topics` cst
LEFT JOIN `coaching_sessions` cs ON cs.id = cst.session_id
LEFT JOIN `topics` t ON t.id = cst.topic_id
WHERE cs.id IS NULL OR t.id IS NULL;
