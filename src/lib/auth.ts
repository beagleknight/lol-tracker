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
      if (token.sub && token.userId) {
        // Read user data from the JWT token (populated by jwt callback)
        // instead of querying the DB on every request.
        let effectiveUserId = token.userId as string;
        let realAdminName: string | null = null;

        // Check for impersonation — only admins may impersonate.
        // This is the only path that still hits the DB per-request,
        // and only when the admin-impersonate cookie is set.
        const cookieStore = await cookies();
        const targetUserId = cookieStore.get(IMPERSONATE_COOKIE)?.value;

        if (targetUserId && token.role === "admin" && token.userId !== targetUserId) {
          const targetUser = await db.query.users.findFirst({
            where: eq(users.id, targetUserId),
          });
          if (targetUser && !targetUser.deactivatedAt) {
            effectiveUserId = targetUser.id;
            realAdminName = (token.name as string) ?? null;

            // For impersonated user, populate session from DB
            session.user.id = targetUser.id;
            session.user.riotGameName = targetUser.riotGameName;
            session.user.riotTagLine = targetUser.riotTagLine;
            session.user.isRiotLinked = !!targetUser.puuid;
            session.user.region = targetUser.region;
            session.user.activeRiotAccountId = targetUser.activeRiotAccountId;
            session.user.onboardingCompleted = targetUser.onboardingCompleted;
            session.user.role = targetUser.role;
            session.user.locale = targetUser.locale;
            session.user.language = targetUser.language;
            session.user.coachingCadenceDays = targetUser.coachingCadenceDays;

            // Resolve role preferences for impersonated user
            if (targetUser.activeRiotAccountId) {
              const activeAccount = await db.query.riotAccounts.findFirst({
                where: eq(riotAccounts.id, targetUser.activeRiotAccountId),
                columns: { primaryRole: true, secondaryRole: true },
              });
              session.user.primaryRole = activeAccount?.primaryRole ?? null;
              session.user.secondaryRole = activeAccount?.secondaryRole ?? null;
            } else {
              session.user.primaryRole = targetUser.primaryRole;
              session.user.secondaryRole = targetUser.secondaryRole;
            }

            session.user.isImpersonating = true;
            session.user.realAdminName = realAdminName;
            return session;
          }
        }

        // Normal path: read everything from the JWT token (zero DB queries)
        session.user.id = effectiveUserId;
        session.user.riotGameName = (token.riotGameName as string) ?? null;
        session.user.riotTagLine = (token.riotTagLine as string) ?? null;
        session.user.isRiotLinked = (token.isRiotLinked as boolean) ?? false;
        session.user.region = (token.region as string) ?? null;
        session.user.activeRiotAccountId = (token.activeRiotAccountId as string) ?? null;
        session.user.onboardingCompleted = (token.onboardingCompleted as boolean) ?? false;
        session.user.role = (token.role as "admin" | "premium" | "free") ?? "free";
        session.user.locale = (token.locale as string) ?? null;
        session.user.language = (token.language as string) ?? null;
        session.user.coachingCadenceDays = (token.coachingCadenceDays as number) ?? null;
        session.user.primaryRole = (token.primaryRole as string) ?? null;
        session.user.secondaryRole = (token.secondaryRole as string) ?? null;
      }
      return session;
    },
    async jwt({ token, account, trigger }) {
      if (account?.provider === "discord" || account?.provider === "demo") {
        token.discordId = account.providerAccountId;
      }

      // On sign-in or explicit session.update(), load user data into the JWT
      // so the session callback doesn't need to hit the DB on every request.
      if (trigger === "signIn" || trigger === "update" || (token.discordId && !token.userId)) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.discordId, token.discordId as string),
        });
        if (dbUser) {
          token.userId = dbUser.id;
          token.riotGameName = dbUser.riotGameName;
          token.riotTagLine = dbUser.riotTagLine;
          token.isRiotLinked = !!dbUser.puuid;
          token.region = dbUser.region;
          token.activeRiotAccountId = dbUser.activeRiotAccountId;
          token.onboardingCompleted = dbUser.onboardingCompleted;
          token.role = dbUser.role;
          token.locale = dbUser.locale;
          token.language = dbUser.language;
          token.coachingCadenceDays = dbUser.coachingCadenceDays;

          // Resolve role preferences from active riot account
          if (dbUser.activeRiotAccountId) {
            const activeAccount = await db.query.riotAccounts.findFirst({
              where: eq(riotAccounts.id, dbUser.activeRiotAccountId),
              columns: { primaryRole: true, secondaryRole: true },
            });
            token.primaryRole = activeAccount?.primaryRole ?? null;
            token.secondaryRole = activeAccount?.secondaryRole ?? null;
          } else {
            token.primaryRole = dbUser.primaryRole;
            token.secondaryRole = dbUser.secondaryRole;
          }
        }
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
