"use server";

import { eq, like, sql } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { users, matches, riotAccounts } from "@/db/schema";
import { isDemoUserId } from "@/lib/fake-auth";
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

  // Use scalar subqueries instead of LEFT JOIN to avoid row explosion
  // (users × matches GROUP BY). Each subquery is a simple indexed lookup.
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
      matchCount:
        sql<number>`(SELECT count(*) FROM matches WHERE matches.user_id = "users"."id")`.as(
          "match_count",
        ),
      scopedMatchCount:
        sql<number>`(SELECT count(*) FROM matches WHERE matches.user_id = "users"."id" AND matches.riot_account_id = "users"."active_riot_account_id")`.as(
          "scoped_match_count",
        ),
      lastSync: sql<
        string | null
      >`(SELECT max(matches.synced_at) FROM matches WHERE matches.user_id = "users"."id")`.as(
        "last_sync",
      ),
    })
    .from(users)
    .orderBy(users.createdAt);

  // Hide the demo user from the admin list — it's synthetic seed data,
  // not a real user, and impersonating it causes a broken read-only state.
  return rows
    .filter((r) => !isDemoUserId(r.id))
    .map((r) => ({
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

// ─── GDPR PUUID Scrubbing ───────────────────────────────────────────────────

/**
 * Scrub a PUUID from all stored data. Used to process GDPR deletion requests
 * received from Riot Games for non-registered players whose data appears in
 * stored match records (rawMatchJson blobs).
 *
 * What this does:
 * 1. If any registered user has this PUUID → deletes their account (full cascade)
 * 2. Nulls out duoPartnerPuuid references on any matches
 * 3. Scrubs the PUUID, summoner name, and game name from all rawMatchJson blobs
 *
 * Returns the count of affected matches for confirmation.
 */
export async function scrubPuuidFromAllData(puuid: string) {
  await requireAdmin();

  // Validate PUUID format (Riot PUUIDs are 78-char hex strings with hyphens)
  if (!puuid || !/^[\da-f-]{40,80}$/i.test(puuid.trim())) {
    throw new Error("Invalid PUUID format");
  }

  const normalizedPuuid = puuid.trim();

  // ── 1. Check if any registered user owns this PUUID ────────────────────
  const linkedAccount = await db.query.riotAccounts.findFirst({
    where: eq(riotAccounts.puuid, normalizedPuuid),
  });

  if (linkedAccount) {
    // This PUUID belongs to a registered user — their deleteAccount flow handles it.
    // We don't cascade-delete from admin to avoid accidentally nuking a real user.
    return {
      success: false,
      error: "PUUID_BELONGS_TO_USER" as const,
      userId: linkedAccount.userId,
    };
  }

  // ── 2. Null out duoPartnerPuuid on matches ─────────────────────────────
  const duoResult = await db
    .update(matches)
    .set({
      duoPartnerPuuid: null,
      duoPartnerChampionName: null,
      duoPartnerKills: null,
      duoPartnerDeaths: null,
      duoPartnerAssists: null,
    })
    .where(eq(matches.duoPartnerPuuid, normalizedPuuid));

  // ── 3. Scrub PUUID from rawMatchJson blobs ─────────────────────────────
  // Find all matches whose rawMatchJson contains this PUUID
  const affectedMatches = await db
    .select({ id: matches.id, userId: matches.userId, rawMatchJson: matches.rawMatchJson })
    .from(matches)
    .where(like(matches.rawMatchJson, `%${normalizedPuuid}%`));

  let scrubbedCount = 0;

  for (const match of affectedMatches) {
    if (!match.rawMatchJson) continue;

    try {
      const json = JSON.parse(match.rawMatchJson);
      const scrubbed = scrubPuuidFromMatchJson(json, normalizedPuuid);

      await db
        .update(matches)
        .set({ rawMatchJson: JSON.stringify(scrubbed) })
        .where(sql`${matches.id} = ${match.id} AND ${matches.userId} = ${match.userId}`);

      scrubbedCount++;
    } catch {
      // If JSON is malformed, do a simple string replacement as fallback
      const replaced = match.rawMatchJson.replaceAll(normalizedPuuid, "[REDACTED]");
      await db
        .update(matches)
        .set({ rawMatchJson: replaced })
        .where(sql`${matches.id} = ${match.id} AND ${matches.userId} = ${match.userId}`);
      scrubbedCount++;
    }
  }

  return {
    success: true,
    duoReferencesCleared: duoResult.rowsAffected ?? 0,
    matchJsonsScrubbed: scrubbedCount,
  };
}

/**
 * Scrub a specific PUUID's identifiable data from a parsed Riot match JSON.
 * Replaces the PUUID, summonerName, riotIdGameName, and riotIdTagline
 * with "[REDACTED]" in the participant entry matching the given PUUID.
 */
function scrubPuuidFromMatchJson(json: Record<string, unknown>, puuid: string) {
  // The Riot match JSON structure: { info: { participants: [...] }, metadata: { participants: [...] } }
  const info = json.info as Record<string, unknown> | undefined;
  const metadata = json.metadata as Record<string, unknown> | undefined;

  // Scrub from metadata.participants (array of PUUID strings)
  if (metadata?.participants && Array.isArray(metadata.participants)) {
    metadata.participants = (metadata.participants as string[]).map((p) =>
      p === puuid ? "[REDACTED]" : p,
    );
  }

  // Scrub from info.participants (array of participant objects)
  if (info?.participants && Array.isArray(info.participants)) {
    for (const participant of info.participants as Record<string, unknown>[]) {
      if (participant.puuid === puuid) {
        participant.puuid = "[REDACTED]";
        participant.summonerName = "[REDACTED]";
        participant.riotIdGameName = "[REDACTED]";
        participant.riotIdTagline = "[REDACTED]";
        break;
      }
    }
  }

  return json;
}
