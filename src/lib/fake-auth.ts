/**
 * Fake auth utilities for demo/preview mode.
 *
 * When NEXT_PUBLIC_DEMO_MODE is set, a Credentials provider is added to
 * NextAuth that accepts a demo user ID and creates a real session.
 * This avoids any changes to session handling, useSession(), or SessionProvider.
 *
 * Safety: The Credentials provider checks NEXT_PUBLIC_DEMO_MODE at runtime
 * and rejects all attempts if the flag is not set.
 */

import Credentials from "next-auth/providers/credentials";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export function isDemoMode(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true";
}

/**
 * Returns the demo Credentials provider. Only authorizes when
 * NEXT_PUBLIC_DEMO_MODE is "true" at runtime.
 */
export function demoCredentialsProvider() {
  return Credentials({
    id: "demo",
    name: "Demo Login",
    credentials: {
      userId: { label: "User ID", type: "text" },
    },
    async authorize(credentials) {
      // Runtime guard — never authorize in production even if
      // this provider somehow ends up in the config
      if (process.env.NEXT_PUBLIC_DEMO_MODE !== "true") {
        return null;
      }

      const userId = credentials?.userId;
      if (!userId || typeof userId !== "string") return null;

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
