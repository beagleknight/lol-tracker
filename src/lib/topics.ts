/**
 * Topic utilities.
 *
 * The canonical topic list now lives in the `topics` database table.
 * This module provides helpers to query topics and a static slug map
 * for use in contexts where DB access isn't available (e.g., constants).
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { topics } from "@/db/schema";

/**
 * Fetch all default (predefined) topics from the database.
 * Returns topics sorted by ID (insertion order = original predefined order).
 */
export async function getDefaultTopics() {
  return db.query.topics.findMany({
    where: eq(topics.isDefault, true),
    orderBy: topics.id,
  });
}

/**
 * Fetch all topics visible to a user (defaults + their custom ones).
 */
export async function getTopicsForUser(userId: string) {
  const { or } = await import("drizzle-orm");
  return db.query.topics.findMany({
    where: or(eq(topics.isDefault, true), eq(topics.userId, userId)),
    orderBy: topics.id,
  });
}

/**
 * Find a topic by its slug.
 */
export async function getTopicBySlug(slug: string) {
  return db.query.topics.findFirst({
    where: eq(topics.slug, slug),
  });
}

/**
 * Find a topic by its ID.
 */
export async function getTopicById(id: number) {
  return db.query.topics.findFirst({
    where: eq(topics.id, id),
  });
}

/**
 * Predefined reasons for skipping VOD review.
 */
export const SKIP_REVIEW_REASONS = [
  "Already know what went wrong",
  "Stomp — nothing to review",
] as const;
