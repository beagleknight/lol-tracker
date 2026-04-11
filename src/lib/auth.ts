import { eq, count } from "drizzle-orm";
import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { cookies } from "next/headers";

import { db } from "@/db";
import { users, invites, riotAccounts } from "@/db/schema";
import { isDemoMode, demoCredentialsProvider } from "@/lib/fake-auth";

// Duplicated from session.ts to avoid circular import (session.ts imports auth.ts)
const IMPERSONATE_COOKIE = "admin-impersonate";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    // Auth.js auto-reads AUTH_DISCORD_ID and AUTH_DISCORD_SECRET from
    // process.env at request time (via setEnvDefaults), which avoids
    // the dotenvx banner corruption that happens at module load time.
    Discord({
      authorization: {
        params: { prompt: "none" },
      },
    }),
    // Demo/preview mode: cookie-based Credentials provider that bypasses
    // Discord OAuth. Only authorizes when NEXT_PUBLIC_DEMO_MODE=true.
    ...(isDemoMode() ? [demoCredentialsProvider()] : []),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // ── Demo provider: user already exists in DB (seeded) ──
      if (account?.provider === "demo" && account.providerAccountId) {
        const existing = await db.query.users.findFirst({
          where: eq(users.discordId, account.providerAccountId),
        });
        if (!existing) return false;

        // Block deactivated users
        if (existing.deactivatedAt) {
          return "/login?error=account-deactivated";
        }

        const cookieStore = await cookies();
        cookieStore.set("language", existing.language || "en", {
          path: "/",
          httpOnly: false,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          maxAge: 60 * 60 * 24 * 365,
        });
        if (existing.puuid) {
          cookieStore.set("sync_on_login", "1", {
            path: "/",
            httpOnly: false,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60,
          });
        }
        return true;
      }

      if (account?.provider === "discord" && account.providerAccountId) {
        // Check if user already exists
        const existing = await db.query.users.findFirst({
          where: eq(users.discordId, account.providerAccountId),
        });

        if (existing) {
          // Block deactivated users
          if (existing.deactivatedAt) {
            return "/login?error=account-deactivated";
          }

          // Returning user — update name/image
          await db
            .update(users)
            .set({
              name: user.name || existing.name,
              image: user.image || existing.image,
              updatedAt: new Date(),
            })
            .where(eq(users.discordId, account.providerAccountId));

          // Set language cookie for next-intl (avoids DB query per request)
          const cookieStore = await cookies();
          cookieStore.set("language", existing.language || "en", {
            path: "/",
            httpOnly: false, // Client JS needs to read it
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 365, // 1 year
          });

          // Trigger auto-sync on login if Riot account is linked
          if (existing.puuid) {
            cookieStore.set("sync_on_login", "1", {
              path: "/",
              httpOnly: false, // Client JS needs to read it
              sameSite: "lax",
              secure: process.env.NODE_ENV === "production",
              maxAge: 60, // Short-lived — consumed once by the client
            });
          }

          return true;
        }

        // New user — check if this is the very first user (auto-admin)
        const [{ total }] = await db.select({ total: count() }).from(users);

        if (total === 0) {
          // First user ever — create as admin, no invite needed
          const id = crypto.randomUUID();
          await db.insert(users).values({
            id,
            discordId: account.providerAccountId,
            name: user.name || "Unknown",
            image: user.image,
            email: user.email,
            role: "admin",
          });
          return true;
        }

        // Not the first user — require a valid invite code
        const cookieStore = await cookies();
        const inviteCode = cookieStore.get("invite-code")?.value;

        if (!inviteCode) {
          return "/login?error=invite-required";
        }

        // Look up unused invite
        const invite = await db.query.invites.findFirst({
          where: eq(invites.code, inviteCode),
        });

        if (!invite || invite.usedBy) {
          return "/login?error=invite-invalid";
        }

        // Check if invite has expired
        if (invite.expiresAt && invite.expiresAt < new Date()) {
          return "/login?error=invite-expired";
        }

        // Valid invite — create user and mark invite as used
        const id = crypto.randomUUID();
        await db.insert(users).values({
          id,
          discordId: account.providerAccountId,
          name: user.name || "Unknown",
          image: user.image,
          email: user.email,
          role: "free",
        });

        await db
          .update(invites)
          .set({
            usedBy: id,
            usedAt: new Date(),
          })
          .where(eq(invites.id, invite.id));

        // Clear the invite cookie
        cookieStore.delete("invite-code");

        return true;
      }
      return true;
    },
    async session({ session, token }) {
      if (token.sub) {
        // Look up our internal user by discord ID (the real JWT user)
        const dbUser = await db.query.users.findFirst({
          where: eq(users.discordId, token.discordId as string),
        });
        if (!dbUser) return session;

        // Check for impersonation — only admins may impersonate
        let effectiveUser = dbUser;
        let impersonating = false;
        const cookieStore = await cookies();
        const targetUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value;

        if (targetUserId && dbUser.role === "admin" && dbUser.id !== targetUserId) {
          const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
          });
          if (targetUser && !targetUser.deactivatedAt) {
            effectiveUser = targetUser;
            impersonating = true;
          }
        }

        session.user.id = effectiveUser.id;
        session.user.riotGameName = effectiveUser.riotGameName;
        session.user.riotTagLine = effectiveUser.riotTagLine;
        session.user.isRiotLinked = !!effectiveUser.puuid;
        session.user.region = effectiveUser.region;
        session.user.activeRiotAccountId = effectiveUser.activeRiotAccountId;
        session.user.onboardingCompleted = effectiveUser.onboardingCompleted;
        session.user.role = impersonating ? effectiveUser.role : dbUser.role;
        session.user.locale = effectiveUser.locale;
        session.user.language = effectiveUser.language;
        session.user.coachingCadenceDays = effectiveUser.coachingCadenceDays;

        // Read role preferences from the active riot account (per-account)
        if (effectiveUser.activeRiotAccountId) {
          const activeAccount = await db.query.riotAccounts.findFirst({
            where: eq(riotAccounts.id, effectiveUser.activeRiotAccountId),
          });
          session.user.primaryRole = activeAccount?.primaryRole ?? null;
          session.user.secondaryRole = activeAccount?.secondaryRole ?? null;
        } else {
          // Fallback to user-level roles for backwards compatibility
          session.user.primaryRole = effectiveUser.primaryRole;
          session.user.secondaryRole = effectiveUser.secondaryRole;
        }

        // Signal impersonation state to the client
        if (impersonating) {
          session.user.isImpersonating = true;
          session.user.realAdminName = dbUser.name;
        }
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account?.provider === "discord" || account?.provider === "demo") {
        token.discordId = account.providerAccountId;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
