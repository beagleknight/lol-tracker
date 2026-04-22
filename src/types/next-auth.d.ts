import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      riotGameName?: string | null;
      riotTagLine?: string | null;
      isRiotLinked?: boolean;
      region?: string | null;
      activeRiotAccountId?: string | null;
      onboardingCompleted?: boolean;
      role?: "admin" | "premium" | "free" | null;
      locale?: string | null;
      language?: string | null;
      primaryRole?: string | null;
      secondaryRole?: string | null;
      coachingCadenceDays?: number | null;
      /** True when an admin is impersonating this user */
      isImpersonating?: boolean;
      /** The real admin's display name during impersonation */
      realAdminName?: string | null;
      /** True when the user is a public demo user (read-only) */
      isDemoUser?: boolean;
    };
  }
}
