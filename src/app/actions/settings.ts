"use server";

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/session";
import {
  getAccountByRiotId,
  getSummonerByPuuid,
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
