"use server";

import { eq, count, max, sql } from "drizzle-orm";

import { db } from "@/db";
import { users, matches } from "@/db/schema";
import { requireUser } from "@/lib/session";

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") {
    throw new Error("Unauthorized: admin access required");
  }
  return user;
}

export interface AdminUser {
  id: string;
  name: string | null;
  image: string | null;
  discordId: string;
  riotGameName: string | null;
  riotTagLine: string | null;
  region: string | null;
  role: "admin" | "user";
  deactivatedAt: Date | null;
  createdAt: Date;
  matchCount: number;
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
