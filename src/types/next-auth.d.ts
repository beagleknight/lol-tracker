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
      puuid?: string | null;
      role?: string | null;
    };
  }
}
