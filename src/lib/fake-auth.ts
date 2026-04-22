/**
 * Fake auth utilities for demo/preview mode.
 *
 * A Credentials provider is always registered that accepts demo user IDs
 * (prefixed with "demo-") and creates a real NextAuth session.
 * This avoids any changes to session handling, useSession(), or SessionProvider.
 *
 * In preview mode (NEXT_PUBLIC_DEMO_MODE=true), any seeded user can log in
 * via the demo login form. In production, only "demo-" prefixed user IDs
 * are accepted (the public demo user).
 */

import { eq } from "drizzle-orm";
import Credentials from "next-auth/providers/credentials";

import { db } from "@/db";
import { users } from "@/db/schema";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/** Check if a user ID belongs to a seeded demo user. */
export function isDemoUserId(userId: string): boolean {
  return userId.startsWith("demo-");
}

/**
 * Returns the demo Credentials provider.
 *
 * In preview mode (NEXT_PUBLIC_DEMO_MODE=true): authorizes any seeded user.
 * In production: only authorizes demo-prefixed user IDs.
 */
export function demoCredentialsProvider() {
  return Credentials({
    id: "demo",
    name: "Demo Login",
    credentials: {
      userId: { label: "User ID", type: "text" },
    },
    async authorize(credentials) {
      const userId = credentials?.userId;
      if (!userId || typeof userId !== "string") return null;

      // In production, only allow demo-prefixed user IDs
      if (!isDemoMode() && !isDemoUserId(userId)) {
        return null;
      }

      // Look up the seeded user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
      });

      if (!user) return null;

      // Return a NextAuth-compatible user object.
      // The `id` here becomes `token.sub` in the JWT callback,
      // and `account.providerAccountId` in the signIn callback.
      return {
        id: user.discordId, // Must match discordId for the existing JWT/session flow
        name: user.name,
        image: user.image,
        email: user.email,
      };
    },
  });
}
