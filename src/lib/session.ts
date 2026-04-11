import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { type User, users, riotAccounts } from "@/db/schema";
import { auth } from "@/lib/auth";

// ─── Impersonation cookie name ──────────────────────────────────────────────
export const IMPERSONATE_COOKIE = "admin-impersonate";

// ─── Resolve role preferences from the active Riot account ─────────────────
// The users table has a cached `primaryRole`/`secondaryRole`, but the
// authoritative source is the per-account value on `riotAccounts`.
// This helper reads from the active account when available, falling back
// to the users table cache. Both the session callback (client path) and
// getCurrentUser (server path) must use the same resolution logic.
async function resolveRolePreferences(
  user: User,
): Promise<{ primaryRole: string | null; secondaryRole: string | null }> {
  if (user.activeRiotAccountId) {
    const activeAccount = await db.query.riotAccounts.findFirst({
      where: eq(riotAccounts.id, user.activeRiotAccountId),
      columns: { primaryRole: true, secondaryRole: true },
    });
    if (activeAccount) {
      return {
        primaryRole: activeAccount.primaryRole ?? null,
        secondaryRole: activeAccount.secondaryRole ?? null,
      };
    }
  }
  // Fallback to user-level roles for backwards compatibility
  return {
    primaryRole: user.primaryRole,
    secondaryRole: user.secondaryRole,
  };
}

// ─── Real user (ignores impersonation) ──────────────────────────────────────
// Always returns the JWT session user. Used by admin routes and
// impersonation guards so the real admin identity is never masked.
export const getRealUser = cache(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    return null;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return null;
  if (user.deactivatedAt) return null;

  return user;
});

// ─── Current user (impersonation-aware) ─────────────────────────────────────
// cache() deduplicates this call within a single request,
// so layout + page calling requireUser() only hits the DB once.
// Role preferences (primaryRole/secondaryRole) are resolved from the active
// Riot account to stay consistent with what the session callback sends to
// client components via useAuth().
export const getCurrentUser = cache(async () => {
  const realUser = await getRealUser();
  if (!realUser) return null;

  // Check for impersonation cookie
  const cookieStore = await cookies();
  const targetUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value;

  let effectiveUser = realUser;

  if (targetUserId) {
    // Only admins may impersonate
    if (realUser.role === "admin") {
      const targetUser = await db.query.users.findFirst({
        where: eq(users.id, targetUserId),
      });

      // Use target if valid and not deactivated, otherwise fall back to real user
      if (targetUser && !targetUser.deactivatedAt) {
        effectiveUser = targetUser;
      }
    }
  }

  // Resolve role preferences from the active Riot account (authoritative source)
  const roles = await resolveRolePreferences(effectiveUser);

  return {
    ...effectiveUser,
    primaryRole: roles.primaryRole,
    secondaryRole: roles.secondaryRole,
  };
});

// ─── Impersonation helpers ──────────────────────────────────────────────────

/** Returns true if the current request is under admin impersonation. */
export async function isImpersonating(): Promise<boolean> {
  const cookieStore = await cookies();
  const targetUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
  if (!targetUserId) return false;

  // Verify the real user is actually an admin
  const realUser = await getRealUser();
  return !!realUser && realUser.role === "admin" && realUser.id !== targetUserId;
}

/** Throws if currently impersonating. Use as a guard in mutative server actions. */
export async function blockIfImpersonating(): Promise<void> {
  if (await isImpersonating()) {
    throw new Error("Action blocked: you are viewing as another user (read-only mode)");
  }
}

// ─── Auth requirement helpers ───────────────────────────────────────────────

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function requireAdmin() {
  // Always check the REAL user for admin routes — impersonation must not
  // grant admin access to a non-admin target user.
  const user = await getRealUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    throw new Error("Unauthorized: admin access required");
  }
  return user;
}

export async function requirePremium() {
  const user = await requireUser();
  if (!isPremium(user)) {
    throw new Error("Unauthorized: premium access required");
  }
  return user;
}

export function isPremium(user: User): boolean {
  return user.role === "admin" || user.role === "premium";
}
