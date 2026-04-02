---
name: nextjs-auth
description: Auth.js (NextAuth v5) configuration with Discord provider, invite-only registration, JWT sessions, and env var conventions for Next.js on Vercel
---

## What I do

Guide Auth.js (NextAuth v5) setup and customization for Next.js applications, including Discord OAuth, invite-only registration, JWT session strategy, and safe environment variable conventions.

## When to use me

- Configuring or modifying authentication flows
- Adding new OAuth providers
- Implementing invite-only or role-based access control
- Debugging authentication errors (CallbackRouteError, redirect loops, session issues)
- Understanding Auth.js env var naming conventions

## File locations

- Auth config: `src/lib/auth.ts` — providers, callbacks, session strategy
- Session helpers: `src/lib/session.ts` — `getCurrentUser()`, `requireUser()` (cached with React `cache()`)
- Route handler: `src/app/api/auth/[...nextauth]/route.ts`
- Login page: `src/app/(public)/login/page.tsx`

## Environment variable conventions

Auth.js auto-reads these from `process.env` at request time (NOT module load time):

| Variable              | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `AUTH_SECRET`         | JWT signing secret (generate with `npx auth secret`) |
| `AUTH_TRUST_HOST`     | Set to `true` for Vercel deployment                  |
| `AUTH_DISCORD_ID`     | Discord OAuth client ID                              |
| `AUTH_DISCORD_SECRET` | Discord OAuth client secret                          |

**Critical**: Auth.js uses the `AUTH_<PROVIDER>_ID` / `AUTH_<PROVIDER>_SECRET` naming convention. It auto-reads these via `setEnvDefaults()`. Do NOT pass explicit `clientId`/`clientSecret` to the provider — it bypasses the safe deferred read and gets corrupted by the dotenvx banner.

```ts
// GOOD — Auth.js reads AUTH_DISCORD_ID and AUTH_DISCORD_SECRET automatically
Discord({
  authorization: { params: { prompt: "none" } },
});

// BAD — reads process.env at module evaluation time, gets corrupted
Discord({
  clientId: process.env.AUTH_DISCORD_ID!,
  clientSecret: process.env.AUTH_DISCORD_SECRET!,
});
```

## Discord provider configuration

### Avoid forced re-authorization

Auth.js defaults to `prompt: "consent"` for Discord, which forces users to re-authorize the app on every login. Fix with:

```ts
Discord({
  authorization: {
    params: { prompt: "none" },
  },
});
```

### Discord snowflake IDs

Discord user IDs are snowflake integers (e.g., `"123456789012345678"`). Store as `text` in the database, not `integer`, to avoid precision loss.

## Invite-only system

### How it works

1. First user ever (when `users` table is empty) is auto-promoted to admin — no invite needed
2. All subsequent users must provide a valid invite code
3. Invite code is stored in a cookie (`invite-code`) before OAuth redirect
4. The `signIn` callback validates the invite code server-side
5. On success: user is created, invite is marked as used, cookie is cleared
6. On failure: redirect to `/login?error=invite-required` or `/login?error=invite-invalid`

### signIn callback pattern

```ts
callbacks: {
  async signIn({ user, account }) {
    if (account?.provider === "discord" && account.providerAccountId) {
      // 1. Check if user already exists -> allow (returning user)
      // 2. Check if first-ever user -> create as admin (no invite)
      // 3. Otherwise -> require valid invite code from cookie
      // 4. Create user, mark invite as used, clear cookie
    }
    return true;
  },
}
```

### Invite management

Admins generate invite codes from the settings page. Schema:

```ts
export const invites = sqliteTable("invites", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  createdBy: text("created_by")
    .notNull()
    .references(() => users.id),
  usedBy: text("used_by").references(() => users.id),
  usedAt: integer("used_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
```

## JWT session strategy

This project uses JWT sessions (not database sessions) for simplicity with Turso:

```ts
session: {
  strategy: "jwt",
},
callbacks: {
  async jwt({ token, account }) {
    if (account?.provider === "discord") {
      token.discordId = account.providerAccountId;
    }
    return token;
  },
  async session({ session, token }) {
    // Look up internal user by discordId stored in JWT
    const dbUser = await db.query.users.findFirst({
      where: eq(users.discordId, token.discordId as string),
    });
    if (dbUser) {
      session.user.id = dbUser.id;
      session.user.role = dbUser.role;
      // ... other fields
    }
    return session;
  },
}
```

## Performance: cached requireUser()

`requireUser()` calls `auth()` + DB lookup. Both the layout and the page component call it, causing duplicate work. Fix with React `cache()`:

```ts
import { cache } from "react";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  return db.query.users.findFirst({ where: eq(users.id, session.user.id) });
});

export const requireUser = cache(async () => {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
});
```

## Common errors

| Error                               | Cause                                                           | Fix                                                                     |
| ----------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `CallbackRouteError`                | Corrupted OAuth secrets (trailing newline, dotenvx banner)      | Re-create env vars with `printf`, not `echo`                            |
| Forced re-authorization every login | `prompt: "consent"` default                                     | Set `prompt: "none"`                                                    |
| `UNTRUST_HOST` error                | Missing `AUTH_TRUST_HOST` on Vercel                             | Add `AUTH_TRUST_HOST=true` env var                                      |
| Infinite redirect loop              | Middleware misconfigured or `signIn` callback returning falsy   | Check callback return values, ensure login page is public               |
| Session missing custom fields       | Not extending session type or not mapping in `session` callback | Extend `Session` type in `types/next-auth.d.ts`, map fields in callback |

## Security

### Session data minimization

The JWT session should contain only the minimum data needed by client components. Sensitive identifiers like `puuid` should NOT be in the session — use `isRiotLinked: boolean` instead. Server components that need the full user record should call `requireUser()` which reads from the DB.

### Cookie security

All cookies set by Auth.js and custom code must include the `Secure` flag. Auth.js handles this automatically in production. For custom cookies (invite codes, onboarding state), set `secure: true` explicitly.

### requireUser() and requireAdmin()

Both are in `src/lib/session.ts`. Every server action and API route must call one as its first operation. `requireAdmin()` is used for admin-only actions and is also checked at the layout level in `src/app/(app)/admin/layout.tsx`.
