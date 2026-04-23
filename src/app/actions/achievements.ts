"use server";

import type { AchievementTransition } from "@/lib/achievements";

import { evaluateAchievements } from "@/lib/achievements";
import { requireUser } from "@/lib/session";

/**
 * Trigger achievement evaluation for the current user.
 * Designed to be called from the client without blocking page render.
 */
export async function checkAchievements(): Promise<{
  transitions: AchievementTransition[];
  error?: string;
}> {
  try {
    const user = await requireUser();
    const transitions = await evaluateAchievements(user.id);
    return { transitions };
  } catch {
    return { transitions: [], error: "Failed to evaluate achievements" };
  }
}
