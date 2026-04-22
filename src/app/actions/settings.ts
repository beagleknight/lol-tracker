"use server";

import { eq, and, isNotNull, ne, like, or, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import { users, riotAccounts } from "@/db/schema";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n/request";
import { invalidateAllCaches, invalidateDuoCaches } from "@/lib/cache";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/format";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAccountByRiotId, RiotApiError, PLATFORM_IDS } from "@/lib/riot-api";
import { blockDemoWrites, blockIfImpersonating, requireUser } from "@/lib/session";

const MAX_RIOT_ACCOUNTS = 5;

export async function linkRiotAccount(formData: FormData) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // Rate limit check
  const rateCheck = await checkRateLimit(user.id, "riot_lookup");
  if (!rateCheck.allowed) {
    return {
      error: `Rate limit exceeded. Try again in ${rateCheck.retryAfter} seconds.`,
    };
  }

  const riotId = formData.get("riotId") as string;
  if (!riotId || !riotId.includes("#")) {
    return { error: "Invalid Riot ID format. Use GameName#TagLine" };
  }

  const region = formData.get("region") as string;
  if (!region || !PLATFORM_IDS.includes(region)) {
    return { error: "Please select a valid region." };
  }

  const [gameName, tagLine] = riotId.split("#");
  if (!gameName || !tagLine) {
    return { error: "Invalid Riot ID format. Use GameName#TagLine" };
  }

  // Check account limit
  const [{ total }] = await db
    .select({ total: count() })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, user.id));

  if (total >= MAX_RIOT_ACCOUNTS) {
    return { error: `You can link up to ${MAX_RIOT_ACCOUNTS} Riot accounts.` };
  }

  try {
    // Look up account via Riot API (using the selected region)
    const account = await getAccountByRiotId(gameName, tagLine, region);

    // Check if this PUUID is already linked to this user
    const existing = await db.query.riotAccounts.findFirst({
      where: and(eq(riotAccounts.userId, user.id), eq(riotAccounts.puuid, account.puuid)),
    });

    if (existing) {
      return { error: "This Riot account is already linked." };
    }

    // First account = primary
    const isPrimary = total === 0;

    const accountId = crypto.randomUUID();
    await db.insert(riotAccounts).values({
      id: accountId,
      userId: user.id,
      puuid: account.puuid,
      riotGameName: account.gameName,
      riotTagLine: account.tagLine,
      region,
      isPrimary,
      // Copy user-level role preferences to first account
      primaryRole: isPrimary ? user.primaryRole : null,
      secondaryRole: isPrimary ? user.secondaryRole : null,
    });

    // Update user record with cached active account fields
    await db
      .update(users)
      .set({
        activeRiotAccountId: accountId,
        riotGameName: account.gameName,
        riotTagLine: account.tagLine,
        puuid: account.puuid,
        region,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/");
    invalidateAllCaches(user.id);

    return {
      success: true,
      gameName: account.gameName,
      tagLine: account.tagLine,
    };
  } catch (error: unknown) {
    console.error("linkRiotAccount error:", error);
    const message =
      error instanceof RiotApiError ? error.userMessage : "Failed to link Riot account";
    return { error: message };
  }
}

export async function unlinkRiotAccount() {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  if (!user.activeRiotAccountId) {
    return { error: "No active Riot account to unlink." };
  }

  // Find the active account
  const account = await db.query.riotAccounts.findFirst({
    where: and(eq(riotAccounts.id, user.activeRiotAccountId), eq(riotAccounts.userId, user.id)),
  });

  if (!account) {
    // Fallback: clear user cached fields even if account row is missing
    await db
      .update(users)
      .set({
        activeRiotAccountId: null,
        riotGameName: null,
        riotTagLine: null,
        puuid: null,
        summonerId: null,
        region: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/");
    invalidateAllCaches(user.id);
    return { success: true };
  }

  if (account.isPrimary) {
    // Check if this is the only account — if so, allow unlinking (removes everything)
    const [{ total }] = await db
      .select({ total: count() })
      .from(riotAccounts)
      .where(eq(riotAccounts.userId, user.id));

    if (total > 1) {
      return { error: "Cannot unlink your primary account while other accounts are linked." };
    }
  }

  // Delete the account row (match data FK is SET NULL so data is preserved)
  await db
    .delete(riotAccounts)
    .where(and(eq(riotAccounts.id, account.id), eq(riotAccounts.userId, user.id)));

  // Find next account to make active (if any)
  const nextAccount = await db.query.riotAccounts.findFirst({
    where: eq(riotAccounts.userId, user.id),
  });

  if (nextAccount) {
    // If no primary remains, promote this one
    if (!nextAccount.isPrimary) {
      await db
        .update(riotAccounts)
        .set({ isPrimary: true })
        .where(eq(riotAccounts.id, nextAccount.id));
    }

    await db
      .update(users)
      .set({
        activeRiotAccountId: nextAccount.id,
        puuid: nextAccount.puuid,
        riotGameName: nextAccount.riotGameName,
        riotTagLine: nextAccount.riotTagLine,
        region: nextAccount.region,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  } else {
    // No accounts left
    await db
      .update(users)
      .set({
        activeRiotAccountId: null,
        riotGameName: null,
        riotTagLine: null,
        puuid: null,
        summonerId: null,
        region: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Duo Partner ─────────────────────────────────────────────────────────────

/**
 * Update the user's region (platform ID) without re-linking the Riot account.
 * Useful when a user needs to correct their region after linking.
 */
export async function updateRegion(region: string) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  if (!PLATFORM_IDS.includes(region)) {
    return { error: "Invalid region." };
  }

  await db
    .update(users)
    .set({
      region,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Duo Partner (continued) ────────────────────────────────────────────────

/**
 * Search registered users by Riot ID (gameName or tagLine).
 * Returns max 5 results. Only returns accounts marked as discoverable.
 * Does NOT return puuid (privacy).
 */
export async function searchUsers(query: string) {
  const user = await requireUser();

  const trimmed = query.trim();
  if (trimmed.length < 2) {
    return [];
  }

  const pattern = `%${trimmed}%`;

  // Search discoverable riot accounts instead of the users table cache.
  // This respects the per-account discoverable flag and shows all
  // discoverable accounts (not just the user's active one).
  const result = await db
    .select({
      id: users.id,
      name: users.name,
      riotGameName: riotAccounts.riotGameName,
      riotTagLine: riotAccounts.riotTagLine,
    })
    .from(riotAccounts)
    .innerJoin(users, eq(users.id, riotAccounts.userId))
    .where(
      and(
        ne(riotAccounts.userId, user.id),
        eq(riotAccounts.discoverable, true),
        isNotNull(users.puuid),
        or(like(riotAccounts.riotGameName, pattern), like(riotAccounts.riotTagLine, pattern)),
      ),
    )
    .limit(5);

  return result;
}

/**
 * Get the current user's duo partner info (if set).
 */
export async function getDuoPartner() {
  const user = await requireUser();

  if (!user.duoPartnerUserId) {
    return null;
  }

  const partner = await db.query.users.findFirst({
    where: eq(users.id, user.duoPartnerUserId),
    columns: {
      id: true,
      name: true,
      riotGameName: true,
      riotTagLine: true,
    },
  });

  return partner || null;
}

/**
 * Set the current user's duo partner.
 */
export async function setDuoPartner(partnerUserId: string) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // Verify the partner exists and has a linked Riot account
  const partner = await db.query.users.findFirst({
    where: and(eq(users.id, partnerUserId), isNotNull(users.puuid)),
    columns: { id: true, riotGameName: true, riotTagLine: true },
  });

  if (!partner) {
    return { error: "User not found or has no linked Riot account." };
  }

  await db
    .update(users)
    .set({
      duoPartnerUserId: partnerUserId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/duo");
  invalidateDuoCaches(user.id);

  return {
    success: true,
    partnerName: `${partner.riotGameName}#${partner.riotTagLine}`,
  };
}

/**
 * Clear the current user's duo partner.
 */
export async function clearDuoPartner() {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  await db
    .update(users)
    .set({
      duoPartnerUserId: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/duo");
  invalidateDuoCaches(user.id);

  return { success: true };
}

// ─── Locale Preference ──────────────────────────────────────────────────────

/**
 * Update the user's locale preference.
 */
export async function updateLocale(locale: SupportedLocale) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // Validate locale is supported
  const valid = SUPPORTED_LOCALES.some((l) => l.value === locale);
  if (!valid) {
    return { error: "Unsupported locale." };
  }

  await db
    .update(users)
    .set({
      locale,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Language Preference ────────────────────────────────────────────────────

/**
 * Update the user's UI language preference.
 */
export async function updateLanguage(language: SupportedLanguage) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // Validate language is supported
  const valid = SUPPORTED_LANGUAGES.some((l) => l.value === language);
  if (!valid) {
    return { error: "UNSUPPORTED_LANGUAGE" };
  }

  await db
    .update(users)
    .set({
      language,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Set cookie so next-intl picks it up on the next request
  const cookieStore = await cookies();
  cookieStore.set("language", language, {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Role Preferences ───────────────────────────────────────────────────────

const VALID_POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

// ─── Coaching Cadence ───────────────────────────────────────────────────────

const VALID_CADENCE_DAYS = [7, 14, 21, 30] as const;

/**
 * Update the user's coaching cadence preference (how often to schedule coaching).
 */
export async function updateCoachingCadence(days: number) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  if (!VALID_CADENCE_DAYS.includes(days as (typeof VALID_CADENCE_DAYS)[number])) {
    return { error: "Invalid coaching cadence." };
  }

  await db
    .update(users)
    .set({
      coachingCadenceDays: days,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

/**
 * Update the user's primary and secondary role preferences.
 * Both are optional — passing null clears the preference.
 */
export async function updateRolePreferences(
  primaryRole: string | null,
  secondaryRole: string | null,
) {
  const user = await requireUser();
  await blockIfImpersonating();
  await blockDemoWrites();

  // Validate positions
  if (primaryRole && !VALID_POSITIONS.includes(primaryRole as (typeof VALID_POSITIONS)[number])) {
    return { error: "Invalid primary role." };
  }
  if (
    secondaryRole &&
    !VALID_POSITIONS.includes(secondaryRole as (typeof VALID_POSITIONS)[number])
  ) {
    return { error: "Invalid secondary role." };
  }
  if (primaryRole && secondaryRole && primaryRole === secondaryRole) {
    return { error: "Primary and secondary roles must be different." };
  }

  // Write to the active riot account (per-account roles)
  if (user.activeRiotAccountId) {
    await db
      .update(riotAccounts)
      .set({ primaryRole, secondaryRole })
      .where(and(eq(riotAccounts.id, user.activeRiotAccountId), eq(riotAccounts.userId, user.id)));
  }

  // Sync cache on users table (server-side readers use user.primaryRole)
  await db
    .update(users)
    .set({
      primaryRole,
      secondaryRole,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}
