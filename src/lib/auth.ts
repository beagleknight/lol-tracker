import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { db } from "@/db";
import { users, invites } from "@/db/schema";
import { eq, count, isNull } from "drizzle-orm";
import { cookies } from "next/headers";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Discord({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "discord" && account.providerAccountId) {
        // Check if user already exists
        const existing = await db.query.users.findFirst({
          where: eq(users.discordId, account.providerAccountId),
        });

        if (existing) {
          // Returning user — update name/image
          await db
            .update(users)
            .set({
              name: user.name || existing.name,
              image: user.image || existing.image,
              updatedAt: new Date(),
            })
            .where(eq(users.discordId, account.providerAccountId));
          return true;
        }

        // New user — check if this is the very first user (auto-admin)
        const [{ total }] = await db
          .select({ total: count() })
          .from(users);

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

        // Valid invite — create user and mark invite as used
        const id = crypto.randomUUID();
        await db.insert(users).values({
          id,
          discordId: account.providerAccountId,
          name: user.name || "Unknown",
          image: user.image,
          email: user.email,
          role: "user",
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
        // Look up our internal user by discord ID
        const dbUser = await db.query.users.findFirst({
          where: eq(users.discordId, token.discordId as string),
        });
        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.riotGameName = dbUser.riotGameName;
          session.user.riotTagLine = dbUser.riotTagLine;
          session.user.puuid = dbUser.puuid;
          session.user.role = dbUser.role;
        }
      }
      return session;
    },
    async jwt({ token, account }) {
      if (account?.provider === "discord") {
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
