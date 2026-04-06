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
      role?: string | null;
      locale?: string | null;
      language?: string | null;
      primaryRole?: string | null;
      secondaryRole?: string | null;
      coachingCadenceDays?: number | null;
    };
  }
}
