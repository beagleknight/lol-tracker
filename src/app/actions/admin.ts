"use server";

import { eq, count, max, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { users, matches } from "@/db/schema";
import { IMPERSONATE_COOKIE, requireAdmin } from "@/lib/session";

export interface AdminUser {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string;
  riotGameName: string | null;
  riotTagLine: string | null;
  region: string | null;
  role: "admin" | "premium" | "free";
  deactivatedAt: Date | null;
  createdAt: Date;
  matchCount: number;
  scopedMatchCount: number;
  lastSync: Date | null;
}

export async function getUsers(): Promise<AdminUser[]> {
  await requireAdmin();

  // Single query: join users with aggregated match stats
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      image: users.image,
      discordId: users.discordId,
      riotGameName: users.riotGameName,
      riotTagLine: users.riotTagLine,
      region: users.region,
      role: users.role,
      deactivatedAt: users.deactivatedAt,
      createdAt: users.createdAt,
      matchCount: count(matches.id),
      scopedMatchCount: sql<number>`SUM(CASE WHEN ${matches.riotAccountId} = ${users.activeRiotAccountId} THEN 1 ELSE 0 END)`,
      lastSync: max(matches.syncedAt),
    })
    .from(users)
    .leftJoin(matches, eq(users.id, matches.userId))
    .groupBy(users.id)
    .orderBy(users.createdAt);

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    image: r.image,
    discordId: r.discordId,
    riotGameName: r.riotGameName,
    riotTagLine: r.riotTagLine,
    region: r.region,
    role: r.role,
    deactivatedAt: r.deactivatedAt,
    createdAt: r.createdAt,
    matchCount: r.matchCount,
    scopedMatchCount: r.scopedMatchCount ?? 0,
    lastSync: r.lastSync ? new Date(r.lastSync) : null,
  }));
}

export async function deactivateUser(userId: string) {
  const admin = await requireAdmin();

  // Can't deactivate yourself
  if (userId === admin.id) {
    throw new Error("Cannot deactivate your own account");
  }

  await db
    .update(users)
    .set({ deactivatedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function reactivateUser(userId: string) {
  await requireAdmin();

  await db
    .update(users)
    .set({
      deactivatedAt: sql`null`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));

  return { success: true };
}

export async function updateUserRole(userId: string, role: "premium" | "free") {
  const admin = await requireAdmin();

  // Can't change your own role
  if (userId === admin.id) {
    throw new Error("Cannot change your own role");
  }

  // Validate the role value
  if (role !== "premium" && role !== "free") {
    throw new Error("Invalid role");
  }

  // Don't allow changing admin roles through this action
  const [target] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId));
  if (!target || target.role === "admin") {
    throw new Error("Cannot change admin role");
  }

  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));

  return { success: true };
}

// ─── Impersonation ──────────────────────────────────────────────────────────

export async function startImpersonation(targetUserId: string) {
  const admin = await requireAdmin();

  // Cannot impersonate yourself
  if (targetUserId === admin.id) {
    throw new Error("Cannot impersonate yourself");
  }

  // Look up target user
  const target = await db.query.users.findFirst({
    where: eq(users.id, targetUserId),
  });

  if (!target) {
    throw new Error("User not found");
  }

  // Cannot impersonate another admin
  if (target.role === "admin") {
    throw new Error("Cannot impersonate another admin");
  }

  // Cannot impersonate deactivated users
  if (target.deactivatedAt) {
    throw new Error("Cannot impersonate a deactivated user");
  }

  // Set the impersonation cookie (httpOnly, secure, short-lived)
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, targetUserId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60, // 1 hour — auto-expires as a safety net
  });

  // Don't redirect here — let the client update the session first
  // to avoid a flash of stale (admin) session data on the target page.
  return { success: true };
}

export async function stopImpersonation() {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);

  // Same as above — client handles navigation after session refresh.
  return { success: true };
}
