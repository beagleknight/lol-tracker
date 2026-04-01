"use server";

import { eq, and, isNotNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import { users } from "@/db/schema";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n/request";
import { invalidateAllCaches, invalidateDuoCaches } from "@/lib/cache";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/lib/format";
import { getAccountByRiotId } from "@/lib/riot-api";
import { requireUser } from "@/lib/session";

export async function linkRiotAccount(formData: FormData) {
  const user = await requireUser();

  const riotId = formData.get("riotId") as string;
  if (!riotId || !riotId.includes("#")) {
    return { error: "Invalid Riot ID format. Use GameName#TagLine" };
  }

  const [gameName, tagLine] = riotId.split("#");
  if (!gameName || !tagLine) {
    return { error: "Invalid Riot ID format. Use GameName#TagLine" };
  }

  try {
    // Look up account via Riot API
    const account = await getAccountByRiotId(gameName, tagLine);

    // Update user record
    await db
      .update(users)
      .set({
        riotGameName: account.gameName,
        riotTagLine: account.tagLine,
        puuid: account.puuid,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/dashboard");
    invalidateAllCaches(user.id);

    return {
      success: true,
      gameName: account.gameName,
      tagLine: account.tagLine,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to link Riot account";
    return { error: message };
  }
}

export async function unlinkRiotAccount() {
  const user = await requireUser();

  await db
    .update(users)
    .set({
      riotGameName: null,
      riotTagLine: null,
      puuid: null,
      summonerId: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/dashboard");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Duo Partner ─────────────────────────────────────────────────────────────

/**
 * Get all registered users with linked Riot accounts (excluding current user).
 * Used to populate the duo partner picker.
 */
export async function getRegisteredUsers() {
  const user = await requireUser();

  const result = await db
    .select({
      id: users.id,
      name: users.name,
      riotGameName: users.riotGameName,
      riotTagLine: users.riotTagLine,
      puuid: users.puuid,
    })
    .from(users)
    .where(and(ne(users.id, user.id), isNotNull(users.puuid)));

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
      puuid: true,
    },
  });

  return partner || null;
}

/**
 * Set the current user's duo partner.
 */
export async function setDuoPartner(partnerUserId: string) {
  const user = await requireUser();

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
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Role Preferences ───────────────────────────────────────────────────────

const VALID_POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

/**
 * Update the user's primary and secondary role preferences.
 * Both are optional — passing null clears the preference.
 */
export async function updateRolePreferences(
  primaryRole: string | null,
  secondaryRole: string | null,
) {
  const user = await requireUser();

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
