"use server";

import { eq, count } from "drizzle-orm";

import { db } from "@/db";
import { users, riotAccounts, matches } from "@/db/schema";
import { blockDemoWrites, blockIfImpersonating, requireUser } from "@/lib/session";

/**
 * Permanently delete the current user's account and all associated data.
 *
 * Deletion strategy:
 * 1. Collect the user's PUUIDs (from riot_accounts) before deletion
 * 2. Null out duoPartnerUserId on other users who had this user as duo partner
 * 3. Null out duoPartnerPuuid on other users' matches (privacy cleanup)
 * 4. DELETE FROM users WHERE id = ? — FK cascades handle all 12 child tables
 *
 * Requires the confirmation string "DELETE" to prevent accidental invocation.
 */
export async function deleteAccount(confirmation: string) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // ── Validate confirmation ──────────────────────────────────────────────
  if (confirmation !== "DELETE") {
    return { error: "INVALID_CONFIRMATION" };
  }

  // ── Prevent deletion if user is the only admin ─────────────────────────
  if (user.role === "admin") {
    const [{ total }] = await db
      .select({ total: count() })
      .from(users)
      .where(eq(users.role, "admin"));

    if (total <= 1) {
      return { error: "LAST_ADMIN" };
    }
  }

  // ── Collect user's PUUIDs before cascade deletes them ──────────────────
  const userAccounts = await db
    .select({ puuid: riotAccounts.puuid })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, user.id));

  const puuids = userAccounts.map((a) => a.puuid);

  // ── Cross-reference cleanup (other users' data) ────────────────────────

  // 1. Null out duoPartnerUserId on other users who had this user as partner
  await db
    .update(users)
    .set({ duoPartnerUserId: null, updatedAt: new Date() })
    .where(eq(users.duoPartnerUserId, user.id));

  // 2. Null out duoPartnerPuuid on other users' matches for privacy
  for (const puuid of puuids) {
    await db
      .update(matches)
      .set({
        duoPartnerPuuid: null,
        duoPartnerChampionName: null,
        duoPartnerKills: null,
        duoPartnerDeaths: null,
        duoPartnerAssists: null,
      })
      .where(eq(matches.duoPartnerPuuid, puuid));
  }

  // ── Delete user row — FK cascades handle all child tables ──────────────
  await db.delete(users).where(eq(users.id, user.id));

  return { success: true };
}
