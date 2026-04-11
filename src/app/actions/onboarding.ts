"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { db } from "@/db";
import { users } from "@/db/schema";
import { blockIfImpersonating, requireUser } from "@/lib/session";

/**
 * Complete the onboarding flow.
 *
 * Validates that the user has at minimum a linked Riot account and a region
 * selected, then marks onboarding as complete. Sets the `sync_on_login`
 * cookie so the remaining match history is automatically synced in batches
 * when the user lands on the dashboard.
 */
export async function completeOnboarding() {
  const user = await requireUser();
  await blockIfImpersonating();

  if (user.onboardingCompleted) {
    return { error: "Onboarding already completed." };
  }

  if (!user.puuid || !user.region) {
    return { error: "Please link your Riot account and select a region first." };
  }

  await db
    .update(users)
    .set({
      onboardingCompleted: true,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  // Set sync_on_login cookie so the dashboard's useSyncMatches hook
  // automatically picks up and syncs remaining matches in batches.
  const cookieStore = await cookies();
  cookieStore.set("sync_on_login", "1", {
    path: "/",
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60,
  });

  revalidatePath("/onboarding", "page");
  return { success: true };
}
