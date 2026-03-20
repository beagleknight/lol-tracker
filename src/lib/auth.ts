import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

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
        // Check if user exists, if not create them
        const existing = await db.query.users.findFirst({
          where: eq(users.discordId, account.providerAccountId),
        });

        if (!existing) {
          const id = crypto.randomUUID();
          await db.insert(users).values({
            id,
            discordId: account.providerAccountId,
            name: user.name || "Unknown",
            image: user.image,
            email: user.email,
          });
        } else {
          // Update name/image on each login
          await db
            .update(users)
            .set({
              name: user.name || existing.name,
              image: user.image || existing.image,
              updatedAt: new Date(),
            })
            .where(eq(users.discordId, account.providerAccountId));
        }
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
