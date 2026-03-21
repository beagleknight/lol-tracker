/**
 * Predefined topics shared between coaching sessions and match highlights/lowlights.
 * Used for structured post-game review and coaching session prep.
 */
export const PREDEFINED_TOPICS = [
  "Laning phase",
  "Wave management",
  "Trading patterns",
  "Roaming/map awareness",
  "Vision control",
  "Teamfighting",
  "Macro/objectives",
  "Champion-specific mechanics",
  "Mental/tilt management",
  "Build paths",
] as const;

export type Topic = (typeof PREDEFINED_TOPICS)[number];

/**
 * Predefined reasons for skipping VOD review.
 */
export const SKIP_REVIEW_REASONS = [
  "Already know what went wrong",
  "Stomp — nothing to review",
  "Will review later",
] as const;

export type SkipReviewReason = (typeof SKIP_REVIEW_REASONS)[number];
