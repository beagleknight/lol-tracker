"use server";

import { invalidateAllCaches } from "@/lib/cache";
import { getCurrentUser } from "@/lib/session";

/**
 * Invalidate all caches after a sync completes. Called from the client
 * after the SSE stream sends a "done" event with synced > 0.
 *
 * This exists because updateTag() (used by invalidateAllCaches) can only
 * be called from Server Actions, not from Route Handlers.
 */
export async function invalidateSyncCaches() {
  const user = await getCurrentUser();
  if (!user) return;
  invalidateAllCaches(user.id);
}
