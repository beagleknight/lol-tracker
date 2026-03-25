"use server";

import { signIn } from "@/lib/auth";

/**
 * Server action to log in as a demo user via the Credentials provider.
 * Only works when NEXT_PUBLIC_DEMO_MODE=true (enforced by the provider itself).
 */
export async function demoLogin(userId: string) {
  await signIn("demo", { userId, redirectTo: "/dashboard" });
}
