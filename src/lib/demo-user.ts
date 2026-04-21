/**
 * Demo user constants and helpers for the public demo feature.
 *
 * The public demo at /demo uses a fixed demo user from the database
 * (seeded by scripts/seed-demo.ts). This is completely separate from
 * the NEXT_PUBLIC_DEMO_MODE preview/dev demo mode.
 */

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users, riotAccounts, type User } from "@/db/schema";

// ─── Constants ───────────────────────────────────────────────────────────────

/** Fixed user ID for the public demo user (matches seed-demo.ts) */
export const DEMO_USER_ID = "demo-user-0001-0001-000000000001";

/** Fixed riot account ID for the public demo user */
export const DEMO_RIOT_ACCOUNT_ID = "demo-riot-acct-0001-000000000001";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fetch the demo user from the database. Returns the user with resolved
 * role preferences, similar to what getCurrentUser() returns for real users.
 *
 * Returns null if the demo user doesn't exist (seed hasn't been run).
 */
export async function getDemoUser(): Promise<User | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, DEMO_USER_ID),
  });

  if (!user) return null;

  // Resolve role preferences from active riot account (mirrors session.ts logic)
  if (user.activeRiotAccountId) {
    const activeAccount = await db.query.riotAccounts.findFirst({
      where: eq(riotAccounts.id, user.activeRiotAccountId),
      columns: { primaryRole: true, secondaryRole: true },
    });
    if (activeAccount) {
      return {
        ...user,
        primaryRole: activeAccount.primaryRole ?? null,
        secondaryRole: activeAccount.secondaryRole ?? null,
      };
    }
  }

  return user;
}

/**
 * Fetch riot accounts for the demo user (for sidebar account switcher display).
 */
export async function getDemoRiotAccounts() {
  return db
    .select({
      id: riotAccounts.id,
      puuid: riotAccounts.puuid,
      riotGameName: riotAccounts.riotGameName,
      riotTagLine: riotAccounts.riotTagLine,
      region: riotAccounts.region,
      isPrimary: riotAccounts.isPrimary,
      label: riotAccounts.label,
    })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, DEMO_USER_ID));
}
