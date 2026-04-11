"use server";

import { eq, and, count } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { users, riotAccounts } from "@/db/schema";
import { invalidateAllCaches } from "@/lib/cache";
import { checkRateLimit } from "@/lib/rate-limit";
import { getAccountByRiotId, RiotApiError, PLATFORM_IDS } from "@/lib/riot-api";
import { blockIfImpersonating, isPremium, requireUser } from "@/lib/session";

const MAX_RIOT_ACCOUNTS_PREMIUM = 5;
const MAX_RIOT_ACCOUNTS_FREE = 1;

// ─── Add Riot Account ───────────────────────────────────────────────────────

/**
 * Link a new Riot account to the current user.
 * Creates a riotAccounts row and sets it as active.
 * The first account linked is automatically marked as primary.
 */
export async function addRiotAccount(formData: FormData) {
  const user = await requireUser();
  await blockIfImpersonating();

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

  // Check account limit (premium: 5, free: 1)
  const [{ total }] = await db
    .select({ total: count() })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, user.id));

  const maxAccounts = isPremium(user) ? MAX_RIOT_ACCOUNTS_PREMIUM : MAX_RIOT_ACCOUNTS_FREE;
  if (total >= maxAccounts) {
    if (!isPremium(user)) {
      return { error: "premiumRequired" };
    }
    return { error: `You can link up to ${maxAccounts} Riot accounts.` };
  }

  try {
    // Look up account via Riot API
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
      discoverable: isPrimary, // Primary accounts are discoverable by default, smurfs are hidden
      label: isPrimary ? null : null, // User can set a label later
      // Copy user-level role preferences to first account
      primaryRole: isPrimary ? user.primaryRole : null,
      secondaryRole: isPrimary ? user.secondaryRole : null,
    });

    // Set as active account and update cached fields on user
    await db
      .update(users)
      .set({
        activeRiotAccountId: accountId,
        puuid: account.puuid,
        riotGameName: account.gameName,
        riotTagLine: account.tagLine,
        region,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/");
    invalidateAllCaches(user.id);

    return {
      success: true,
      accountId,
      gameName: account.gameName,
      tagLine: account.tagLine,
    };
  } catch (error: unknown) {
    console.error("addRiotAccount error:", error);
    const message =
      error instanceof RiotApiError ? error.userMessage : "Failed to link Riot account";
    return { error: message };
  }
}

// ─── Remove Riot Account ────────────────────────────────────────────────────

/**
 * Unlink a non-primary Riot account.
 * Match data is kept (riotAccountId becomes null on the row since we use SET NULL).
 * If the removed account was active, switches to the primary account.
 */
export async function removeRiotAccount(accountId: string) {
  const user = await requireUser();
  await blockIfImpersonating();

  // Find the account and verify ownership
  const account = await db.query.riotAccounts.findFirst({
    where: and(eq(riotAccounts.id, accountId), eq(riotAccounts.userId, user.id)),
  });

  if (!account) {
    return { error: "Riot account not found." };
  }

  if (account.isPrimary) {
    return { error: "Cannot remove your primary account." };
  }

  // Delete the account row (match data FK is SET NULL so data is preserved)
  await db
    .delete(riotAccounts)
    .where(and(eq(riotAccounts.id, accountId), eq(riotAccounts.userId, user.id)));

  // If this was the active account, switch to primary
  if (user.activeRiotAccountId === accountId) {
    const primary = await db.query.riotAccounts.findFirst({
      where: and(eq(riotAccounts.userId, user.id), eq(riotAccounts.isPrimary, true)),
    });

    if (primary) {
      await db
        .update(users)
        .set({
          activeRiotAccountId: primary.id,
          puuid: primary.puuid,
          riotGameName: primary.riotGameName,
          riotTagLine: primary.riotTagLine,
          region: primary.region,
          primaryRole: primary.primaryRole,
          secondaryRole: primary.secondaryRole,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    } else {
      // No accounts left (shouldn't happen since primary can't be removed)
      await db
        .update(users)
        .set({
          activeRiotAccountId: null,
          puuid: null,
          riotGameName: null,
          riotTagLine: null,
          region: null,
          primaryRole: null,
          secondaryRole: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
    }
  }

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Switch Active Account ──────────────────────────────────────────────────

/**
 * Switch which Riot account is currently active.
 * Updates the user's cached fields (puuid, riotGameName, etc.)
 * so all data views and sync use this account.
 */
export async function switchActiveAccount(accountId: string) {
  const user = await requireUser();
  await blockIfImpersonating();

  // Verify ownership
  const account = await db.query.riotAccounts.findFirst({
    where: and(eq(riotAccounts.id, accountId), eq(riotAccounts.userId, user.id)),
  });

  if (!account) {
    return { error: "Riot account not found." };
  }

  // Update user's cached active account fields (including per-account roles)
  await db
    .update(users)
    .set({
      activeRiotAccountId: account.id,
      puuid: account.puuid,
      riotGameName: account.riotGameName,
      riotTagLine: account.riotTagLine,
      region: account.region,
      primaryRole: account.primaryRole,
      secondaryRole: account.secondaryRole,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return {
    success: true,
    gameName: account.riotGameName,
    tagLine: account.riotTagLine,
  };
}

// ─── Set Account as Primary ─────────────────────────────────────────────────

/**
 * Change which Riot account is the primary account.
 * The primary account cannot be removed.
 */
export async function setAccountAsPrimary(accountId: string) {
  const user = await requireUser();
  await blockIfImpersonating();

  // Verify ownership
  const account = await db.query.riotAccounts.findFirst({
    where: and(eq(riotAccounts.id, accountId), eq(riotAccounts.userId, user.id)),
  });

  if (!account) {
    return { error: "Riot account not found." };
  }

  if (account.isPrimary) {
    return { success: true }; // Already primary
  }

  // Unset current primary
  await db
    .update(riotAccounts)
    .set({ isPrimary: false })
    .where(and(eq(riotAccounts.userId, user.id), eq(riotAccounts.isPrimary, true)));

  // Set new primary
  await db.update(riotAccounts).set({ isPrimary: true }).where(eq(riotAccounts.id, accountId));

  revalidatePath("/settings");

  return { success: true };
}

// ─── Update Account Label ───────────────────────────────────────────────────

/**
 * Set a user-friendly label for a Riot account (e.g. "Main", "Smurf", "EUW Alt").
 */
export async function updateAccountLabel(accountId: string, label: string | null) {
  const user = await requireUser();
  await blockIfImpersonating();

  const trimmed = label?.trim() || null;
  if (trimmed && trimmed.length > 30) {
    return { error: "Label must be 30 characters or less." };
  }

  // Verify ownership
  const account = await db.query.riotAccounts.findFirst({
    where: and(eq(riotAccounts.id, accountId), eq(riotAccounts.userId, user.id)),
  });

  if (!account) {
    return { error: "Riot account not found." };
  }

  await db.update(riotAccounts).set({ label: trimmed }).where(eq(riotAccounts.id, accountId));

  revalidatePath("/settings");

  return { success: true };
}

// ─── Update Account Role Preferences ────────────────────────────────────────

const VALID_POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

/**
 * Update role preferences for a specific Riot account.
 * If the account is the currently active one, also syncs the cached roles
 * on the users table so server-side readers stay consistent.
 */
export async function updateAccountRolePreferences(
  accountId: string,
  primaryRole: string | null,
  secondaryRole: string | null,
) {
  const user = await requireUser();
  await blockIfImpersonating();

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

  // Verify ownership
  const account = await db.query.riotAccounts.findFirst({
    where: and(eq(riotAccounts.id, accountId), eq(riotAccounts.userId, user.id)),
  });

  if (!account) {
    return { error: "Riot account not found." };
  }

  // Update the riot account
  await db
    .update(riotAccounts)
    .set({ primaryRole, secondaryRole })
    .where(eq(riotAccounts.id, accountId));

  // If this is the active account, sync the cache on users table
  if (user.activeRiotAccountId === accountId) {
    await db
      .update(users)
      .set({ primaryRole, secondaryRole, updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  revalidatePath("/");
  invalidateAllCaches(user.id);

  return { success: true };
}

// ─── Get User Riot Accounts ─────────────────────────────────────────────────

/**
 * Get all Riot accounts linked to the current user.
 * Used by the sidebar switcher and settings page.
 */
export async function getUserRiotAccounts() {
  const user = await requireUser();

  const accounts = await db.query.riotAccounts.findMany({
    where: eq(riotAccounts.userId, user.id),
    columns: {
      id: true,
      puuid: true,
      riotGameName: true,
      riotTagLine: true,
      region: true,
      isPrimary: true,
      discoverable: true,
      label: true,
      primaryRole: true,
      secondaryRole: true,
    },
    orderBy: (table, { desc }) => [desc(table.isPrimary), table.createdAt],
  });

  return accounts;
}

// ─── Toggle Account Discoverability ─────────────────────────────────────────

/**
 * Toggle whether a Riot account appears in duo partner search results.
 * Primary accounts default to discoverable; non-primary default to hidden.
 */
export async function toggleAccountDiscoverable(accountId: string, discoverable: boolean) {
  const user = await requireUser();
  await blockIfImpersonating();

  // Verify ownership
  const account = await db.query.riotAccounts.findFirst({
    where: and(eq(riotAccounts.id, accountId), eq(riotAccounts.userId, user.id)),
  });

  if (!account) {
    return { error: "Riot account not found." };
  }

  await db.update(riotAccounts).set({ discoverable }).where(eq(riotAccounts.id, accountId));

  revalidatePath("/settings");

  return { success: true };
}
