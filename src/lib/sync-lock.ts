// Per-user sync lock backed by Turso/SQLite.
//
// Prevents:
// 1. Same user triggering concurrent syncs (from multiple tabs or auto-sync)
// 2. More than MAX_CONCURRENT_SYNCS running globally (rate limit protection)
//
// Locks auto-expire after LOCK_TTL_MS to handle crashes/timeouts gracefully.

import { eq, lt, sql } from "drizzle-orm";

import { db } from "@/db";
import { syncLocks } from "@/db/schema";

import { MAX_CONCURRENT_SYNCS } from "./rate-limiter";

/** Lock TTL: 5 minutes. If a sync crashes or times out, the lock auto-expires. */
const LOCK_TTL_MS = 5 * 60 * 1000;

export type AcquireLockResult =
  | { status: "acquired" }
  | { status: "already_locked" }
  | { status: "too_many_syncs"; activeSyncs: number };

/**
 * Try to acquire a sync lock for a user.
 *
 * 1. Clean up expired locks first.
 * 2. Check if this user already has an active lock → `already_locked`.
 * 3. Check global concurrency → `too_many_syncs`.
 * 4. Insert the lock → `acquired`.
 */
export async function acquireSyncLock(userId: string): Promise<AcquireLockResult> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

  // 1. Clean up expired locks
  await db.delete(syncLocks).where(lt(syncLocks.expiresAt, now));

  // 2. Check if this user already has a lock
  const existingLock = await db.query.syncLocks.findFirst({
    where: eq(syncLocks.userId, userId),
  });

  if (existingLock) {
    return { status: "already_locked" };
  }

  // 3. Count active (non-expired) locks globally
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(syncLocks);
  const activeSyncs = countResult?.count ?? 0;

  if (activeSyncs >= MAX_CONCURRENT_SYNCS) {
    return { status: "too_many_syncs", activeSyncs };
  }

  // 4. Insert the lock
  // Use INSERT OR IGNORE in case of a race condition where another request
  // inserted a lock for this user between our check and insert.
  try {
    await db.insert(syncLocks).values({
      userId,
      lockedAt: now,
      expiresAt,
    });
    return { status: "acquired" };
  } catch {
    // Unique constraint violation — another request acquired the lock first
    return { status: "already_locked" };
  }
}

/**
 * Release a sync lock for a user.
 * Always call this in a `finally` block after sync completes.
 */
export async function releaseSyncLock(userId: string): Promise<void> {
  await db.delete(syncLocks).where(eq(syncLocks.userId, userId));
}

/**
 * Count currently active (non-expired) sync locks.
 * Used to scale adaptive delays based on concurrency.
 */
export async function getActiveSyncCount(): Promise<number> {
  const now = new Date();

  // Clean expired locks while we're at it
  await db.delete(syncLocks).where(lt(syncLocks.expiresAt, now));

  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(syncLocks);

  return countResult?.count ?? 0;
}

/**
 * Extend the lock expiry (heartbeat) to prevent it from auto-expiring
 * during long syncs. Call periodically during the sync loop.
 */
export async function extendSyncLock(userId: string): Promise<void> {
  const newExpiry = new Date(Date.now() + LOCK_TTL_MS);
  await db.update(syncLocks).set({ expiresAt: newExpiry }).where(eq(syncLocks.userId, userId));
}
