"use client";

// ─── Client-side auth wrapper ───────────────────────────────────────────────
// Thin abstraction over next-auth/react so the rest of the app never imports
// from the auth library directly.  Replacing Auth.js later only requires
// changing *this* file, not every component that needs session data.

import {
  SessionProvider,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
  useSession,
} from "next-auth/react";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  riotGameName?: string | null;
  riotTagLine?: string | null;
  isRiotLinked?: boolean;
  region?: string | null;
  onboardingCompleted?: boolean;
  role?: string | null;
  locale?: string | null;
  language?: string | null;
  primaryRole?: string | null;
  secondaryRole?: string | null;
  coachingCadenceDays?: number | null;
}

export interface UseAuthReturn {
  /** The authenticated user, or `null` while loading / when unauthenticated. */
  user: AuthUser | null;
  /** `true` while the session is being fetched for the first time. */
  isLoading: boolean;
  /** `true` when a valid session exists. */
  isAuthenticated: boolean;
  /** Re-fetch the session from the server (e.g. after a settings change). */
  updateSession: () => Promise<void>;
}

// ─── Hooks ──────────────────────────────────────────────────────────────────

/**
 * Access the current user's session data.
 *
 * Replaces direct `useSession()` calls so components depend on our own
 * interface rather than next-auth's.
 */
export function useAuth(): UseAuthReturn {
  const { data: session, status, update } = useSession();

  return {
    user: session?.user ?? null,
    isLoading: status === "loading",
    isAuthenticated: status === "authenticated",
    updateSession: async () => {
      await update();
    },
  };
}

// ─── Actions ────────────────────────────────────────────────────────────────

/**
 * Trigger a sign-in flow.
 *
 * @param provider - OAuth provider id (defaults to `"discord"`).
 * @param options  - Forwarded to the underlying auth library.
 */
export function login(provider = "discord", options?: { callbackUrl?: string }) {
  return nextAuthSignIn(provider, options);
}

/**
 * Sign the current user out.
 *
 * @param options - Forwarded to the underlying auth library.
 */
export function logout(options?: { callbackUrl?: string }) {
  return nextAuthSignOut(options);
}

// ─── Provider ───────────────────────────────────────────────────────────────

/**
 * Wrap your app tree with this provider to make `useAuth()` available.
 * Drop-in replacement for next-auth's `SessionProvider`.
 */
export const AuthProvider = SessionProvider;
