---
name: security
description: Security patterns for lol-tracker — CSP, cookie flags, error sanitization, auth checks, URL validation, and supply-chain monitoring
---

## What I do

Guide secure coding patterns for the lol-tracker Next.js application, covering HTTP security headers, authentication/authorization checks, input validation, error handling, and supply-chain security.

## When to use me

- Adding new server actions or API routes (auth/authz checklist)
- Rendering user-supplied URLs (XSS prevention)
- Handling external API errors (information leakage prevention)
- Modifying cookies or session data (security flags)
- Reviewing Content Security Policy impact of new external resources
- Adding new npm dependencies (supply-chain risk assessment)

## Security headers

All security headers are configured in `next.config.ts` via the `headers()` function:

- **Content-Security-Policy**: Enforcing (not report-only). Allows `'self'`, `'unsafe-inline'` (required by `next-themes`), and specific external domains (CDN, Discord avatars, DDragon).
- **Strict-Transport-Security**: `max-age=63072000; includeSubDomains; preload`
- **X-Content-Type-Options**: `nosniff`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: Restrictive — disables camera, microphone, geolocation, etc.
- **X-Frame-Options**: `SAMEORIGIN`
- **poweredByHeader**: Disabled in `next.config.ts`

### Adding new external resources

When adding a new external CDN, image host, or script source:

1. Update the CSP in `next.config.ts`
2. Add only the specific domain needed (never use `*`)
3. Test with browser DevTools console — CSP violations appear there

### Why `'unsafe-inline'` is needed

`next-themes` injects an inline `<script>` via `dangerouslySetInnerHTML` to prevent FOUC. Nonce-based CSP is incompatible with Next.js PPR and `cacheComponents: true`. If `next-themes` is removed, switch to nonce-based CSP.

## Authentication & authorization checklist

### Every server action MUST:

1. Call `requireUser()` (or `requireAdmin()`) as its first operation
2. Scope all DB queries with `userId: user.id` from the authenticated session
3. Never accept a `userId` parameter from the client — derive it from the session

### Internal server-to-server functions

Functions called only from other server code (e.g., sync route calling goal checks) must NOT be exported from `"use server"` files. Place them in `src/lib/` instead. If a function in a `"use server"` file accepts a `userId` parameter, it's a red flag — anyone can invoke it with an arbitrary ID.

Pattern:

```
// BAD — in a "use server" file, callable from client with any userId
export async function checkGoalAchievement(userId: string) { ... }

// GOOD — in src/lib/goals.ts (not a server action)
export async function checkGoalAchievement(userId: string) { ... }
```

### Admin routes

- Server-side guard: `src/app/(app)/admin/layout.tsx` checks `user.role === "admin"` and redirects non-admins
- Action-level guard: `requireAdmin()` from `src/lib/session.ts` in every admin action
- Both layers are required — the layout prevents page load, the action prevents direct invocation

## Session data — minimal exposure

The client-side session (JWT) should contain the minimum data needed:

- `id`, `name`, `email`, `image` — standard fields
- `isRiotLinked: boolean` — NOT the raw `puuid`
- `region`, `onboardingCompleted`, `role`, `locale`, `language`, `primaryRole`, `secondaryRole`

Never expose sensitive identifiers (puuid, internal IDs beyond the user's own) in the session token. Server components that need the full DB user should call `requireUser()`.

## URL validation

User-supplied URLs (VOD links, external resources) must be validated:

### On write (server action)

```typescript
import { validateVodUrl } from "@/lib/url";

const sanitised = validateVodUrl(data.vodUrl);
if (data.vodUrl?.trim() && !sanitised) {
  return { error: "Invalid VOD URL. Only http:// and https:// links are allowed." };
}
```

### On render (client component)

```typescript
import { safeExternalUrl } from "@/lib/url";

<a href={safeExternalUrl(match.vodUrl) ?? "#"} target="_blank" rel="noopener noreferrer">
```

Both functions reject `javascript:`, `data:`, `vbscript:`, and other dangerous URI schemes.

## Error sanitization

### Riot API errors

`RiotApiError` (in `src/lib/riot-api.ts`) has a `userMessage` getter that maps HTTP status codes to generic user-facing messages. Server-side code logs the full error; client-facing code uses `userMessage`.

```typescript
catch (err) {
  if (err instanceof RiotApiError) {
    return { error: err.userMessage };  // safe for client
  }
  return { error: "An unexpected error occurred." };
}
```

Never expose raw API responses, status codes, or stack traces to the client.

## Cookie security

All cookies set by the app must include the `Secure` flag in production. Check protocol before setting on the client:

```typescript
// Server-side (always secure in production)
cookies().set("name", value, { secure: true, httpOnly: true, sameSite: "lax" });

// Client-side
document.cookie = `name=value; path=/; max-age=...; samesite=lax${
  window.location.protocol === "https:" ? "; secure" : ""
}`;
```

## Export safety

Data export endpoints (e.g., CSV export) must include a `LIMIT` clause to prevent unbounded queries. The current limit is 10,000 rows in `src/app/api/export/matches/route.ts`.

## Supply-chain security

- **Dependabot**: Vulnerability alerts and automated security updates are enabled on the GitHub repo
- **CI audit**: `npm audit --omit=dev --audit-level=high` runs in CI on every PR, failing on high/critical production vulnerabilities
- **Dev-only CVEs**: Tracked but not blocking (e.g., esbuild CVEs via drizzle-kit)

## SQL injection

Drizzle ORM parameterises all queries automatically. Raw SQL is only used via `sql` tagged template literals, which also parameterise values. No string concatenation in queries.

## Rate limiting

Inbound rate limiting is tracked as a separate issue. The Riot API client handles outbound rate limits via retry logic in `riotFetch`.
