"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq, and, isNotNull, ne } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import {
  getAccountByRiotId,
  getSummonerByPuuid,
  RiotApiError,
} from "@/lib/riot-api";
import { revalidatePath } from "next/cache";

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

    // Get summoner ID
    const summoner = await getSummonerByPuuid(account.puuid);

    // Update user record
    await db
      .update(users)
      .set({
        riotGameName: account.gameName,
        riotTagLine: account.tagLine,
        puuid: account.puuid,
        summonerId: summoner.id,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    revalidatePath("/settings");
    revalidatePath("/dashboard");

    return {
      success: true,
      gameName: account.gameName,
      tagLine: account.tagLine,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to link Riot account";
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

  revalidatePath("/settings");
  revalidatePath("/dashboard");

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
    .where(
      and(
        ne(users.id, user.id),
        isNotNull(users.puuid),
      )
    );

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

  revalidatePath("/settings");
  revalidatePath("/duo");

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

  revalidatePath("/settings");
  revalidatePath("/duo");

  return { success: true };
}
